use std::env;
use std::time::Duration;

use async_trait::async_trait;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::providers::base64::encode_base64;
use crate::providers::traits::{OcrProvider, OcrRequest, OcrResult};

const PROVIDER_ID: &str = "openai_compatible_ocr";
const DEFAULT_BASE_URL: &str = "https://api.openai.com/v1";
const DEFAULT_MODEL: &str = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS: u64 = 20000;

pub struct OpenAiCompatibleOcrProvider {
    config: OpenAiCompatibleOcrConfig,
    client: reqwest::Client,
}

#[derive(Clone)]
struct OpenAiCompatibleOcrConfig {
    api_key: String,
    base_url: String,
    model: String,
}

#[derive(Serialize)]
struct OcrChatCompletionsRequest {
    model: String,
    messages: Vec<OcrChatMessage>,
    temperature: f32,
}

#[derive(Serialize)]
struct OcrChatMessage {
    role: String,
    content: Vec<OcrChatContentPart>,
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum OcrChatContentPart {
    Text { text: String },
    ImageUrl { image_url: OcrImageUrl },
}

#[derive(Serialize)]
struct OcrImageUrl {
    url: String,
}

#[derive(Deserialize)]
struct ChatCompletionsResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

#[derive(Deserialize)]
struct ChatMessage {
    content: String,
}

impl OpenAiCompatibleOcrProvider {
    pub fn from_env() -> Option<Self> {
        let api_key = env::var("OPENAI_API_KEY").ok()?;
        let base_url = env::var("OPENAI_BASE_URL").unwrap_or_else(|_| DEFAULT_BASE_URL.to_string());
        let model = env::var("OPENAI_OCR_MODEL")
            .or_else(|_| env::var("OPENAI_MODEL"))
            .unwrap_or_else(|_| DEFAULT_MODEL.to_string());
        Some(Self {
            config: OpenAiCompatibleOcrConfig {
                api_key,
                base_url,
                model,
            },
            client: reqwest::Client::new(),
        })
    }

    pub fn from_runtime_config(
        api_key: Option<String>,
        base_url: Option<String>,
        model: Option<String>,
    ) -> Result<Self, AppError> {
        let api_key = required_field("openai_compatible_ocr", "api_key", api_key)?;
        Ok(Self {
            config: OpenAiCompatibleOcrConfig {
                api_key,
                base_url: optional_or_default(base_url, DEFAULT_BASE_URL),
                model: optional_or_default(model, DEFAULT_MODEL),
            },
            client: reqwest::Client::new(),
        })
    }

    fn make_prompt(&self, req: &OcrRequest) -> String {
        let hint_text = req
            .source_lang_hint
            .as_ref()
            .map(|hint| format!("Language hint: {hint}."))
            .unwrap_or_default();

        format!(
            "Extract text from the screenshot and return plain text only. \
Do not add explanations. Preserve line breaks where possible. {hint_text}"
        )
    }

    fn read_image_base64(image_path: &str) -> Result<String, AppError> {
        let image_bytes = std::fs::read(image_path).map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!("Failed to read captured image: {error}"),
                false,
            )
        })?;

        if image_bytes.is_empty() {
            return Err(AppError::new(
                ErrorCode::OcrEmptyResult,
                "Captured image is empty",
                false,
            ));
        }

        Ok(encode_base64(&image_bytes))
    }

    fn map_http_error(error: reqwest::Error) -> AppError {
        if error.is_timeout() {
            return AppError::new(ErrorCode::ProviderTimeout, "OCR request timed out", true);
        }

        if let Some(status) = error.status() {
            return match status {
                StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => AppError::new(
                    ErrorCode::ProviderAuthError,
                    "OCR provider authentication failed",
                    false,
                ),
                StatusCode::TOO_MANY_REQUESTS => AppError::new(
                    ErrorCode::ProviderRateLimited,
                    "OCR provider rate limit reached",
                    true,
                ),
                _ => AppError::new(
                    ErrorCode::ProviderNetworkError,
                    format!("OCR provider returned status {status}"),
                    true,
                ),
            };
        }

        AppError::new(
            ErrorCode::ProviderNetworkError,
            format!("OCR provider request failed: {error}"),
            true,
        )
    }

    fn build_request_body(
        &self,
        req: &OcrRequest,
        image_base64: String,
    ) -> OcrChatCompletionsRequest {
        OcrChatCompletionsRequest {
            model: self.config.model.clone(),
            messages: vec![OcrChatMessage {
                role: "user".to_string(),
                content: vec![
                    OcrChatContentPart::Text {
                        text: self.make_prompt(req),
                    },
                    OcrChatContentPart::ImageUrl {
                        image_url: OcrImageUrl {
                            url: format!("data:image/png;base64,{image_base64}"),
                        },
                    },
                ],
            }],
            temperature: 0.0,
        }
    }

    async fn request_ocr(
        &self,
        body: &OcrChatCompletionsRequest,
        timeout: u64,
    ) -> Result<ChatCompletionsResponse, AppError> {
        let endpoint = format!(
            "{}/chat/completions",
            self.config.base_url.trim_end_matches('/')
        );
        let response = self
            .client
            .post(endpoint)
            .bearer_auth(&self.config.api_key)
            .timeout(Duration::from_millis(timeout))
            .json(body)
            .send()
            .await
            .map_err(Self::map_http_error)?;

        response
            .error_for_status()
            .map_err(Self::map_http_error)?
            .json::<ChatCompletionsResponse>()
            .await
            .map_err(|error| {
                AppError::new(
                    ErrorCode::ProviderInvalidResponse,
                    format!("Invalid OCR provider response: {error}"),
                    false,
                )
            })
    }

    fn parse_recognized_text(payload: ChatCompletionsResponse) -> Result<String, AppError> {
        payload
            .choices
            .first()
            .map(|choice| choice.message.content.trim().to_string())
            .filter(|content| !content.is_empty())
            .ok_or_else(|| {
                AppError::new(
                    ErrorCode::OcrEmptyResult,
                    "OCR provider response has empty content",
                    false,
                )
            })
    }
}

fn required_field(
    provider_id: &str,
    field_name: &str,
    value: Option<String>,
) -> Result<String, AppError> {
    let normalized = optional_string(value);
    normalized.ok_or_else(|| {
        AppError::new(
            ErrorCode::ProviderNotConfigured,
            format!("OCR provider `{provider_id}` missing required field `{field_name}`"),
            false,
        )
    })
}

fn optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn optional_or_default(value: Option<String>, default_value: &str) -> String {
    optional_string(value).unwrap_or_else(|| default_value.to_string())
}

#[async_trait]
impl OcrProvider for OpenAiCompatibleOcrProvider {
    async fn recognize(&self, req: OcrRequest) -> Result<OcrResult, AppError> {
        let timeout = if req.timeout_ms == 0 {
            DEFAULT_TIMEOUT_MS
        } else {
            req.timeout_ms
        };
        let image_base64 = read_image_base64_blocking(req.image_path.clone()).await?;
        let body = self.build_request_body(&req, image_base64);
        let payload = self.request_ocr(&body, timeout).await?;
        let recognized_text = Self::parse_recognized_text(payload)?;

        Ok(OcrResult {
            provider_id: PROVIDER_ID.to_string(),
            recognized_text,
        })
    }

    fn provider_id(&self) -> &'static str {
        PROVIDER_ID
    }
}

async fn read_image_base64_blocking(image_path: String) -> Result<String, AppError> {
    tokio::task::spawn_blocking(move || OpenAiCompatibleOcrProvider::read_image_base64(&image_path))
        .await
        .map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!("OCR image read task failed to join: {error}"),
                true,
            )
        })?
}

#[cfg(test)]
mod tests {
    use crate::providers::base64::encode_base64;

    #[test]
    fn encode_base64_handles_padding() {
        assert_eq!(encode_base64(b"f"), "Zg==");
        assert_eq!(encode_base64(b"fo"), "Zm8=");
        assert_eq!(encode_base64(b"foo"), "Zm9v");
    }
}
