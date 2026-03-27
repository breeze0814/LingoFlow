use std::env;
use std::time::Duration;

use async_trait::async_trait;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::providers::traits::{TranslateProvider, TranslateRequest, TranslateResult};

const PROVIDER_ID: &str = "openai_compatible";
const DEFAULT_BASE_URL: &str = "https://api.openai.com/v1";
const DEFAULT_MODEL: &str = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS: u64 = 15000;

pub struct OpenAiCompatibleProvider {
    config: OpenAiCompatibleConfig,
    client: reqwest::Client,
}

#[derive(Clone)]
struct OpenAiCompatibleConfig {
    api_key: String,
    base_url: String,
    model: String,
}

#[derive(Serialize)]
struct ChatCompletionsRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
}

#[derive(Serialize, Deserialize, Clone)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ChatCompletionsResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

impl OpenAiCompatibleProvider {
    pub fn from_env() -> Option<Self> {
        let api_key = env::var("OPENAI_API_KEY").ok()?;
        let base_url = env::var("OPENAI_BASE_URL").unwrap_or_else(|_| DEFAULT_BASE_URL.to_string());
        let model = env::var("OPENAI_MODEL").unwrap_or_else(|_| DEFAULT_MODEL.to_string());
        Some(Self {
            config: OpenAiCompatibleConfig {
                api_key,
                base_url,
                model,
            },
            client: reqwest::Client::new(),
        })
    }

    fn make_prompt(&self, req: &TranslateRequest) -> String {
        format!(
            "Translate the following text from {} to {}. Return only translated text.\nText:\n{}",
            req.source_lang, req.target_lang, req.text
        )
    }

    fn map_http_error(error: reqwest::Error) -> AppError {
        if error.is_timeout() {
            return AppError::new(
                ErrorCode::ProviderTimeout,
                "Translate request timed out",
                true,
            );
        }

        if let Some(status) = error.status() {
            return match status {
                StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => AppError::new(
                    ErrorCode::ProviderAuthError,
                    "Provider authentication failed",
                    false,
                ),
                StatusCode::TOO_MANY_REQUESTS => AppError::new(
                    ErrorCode::ProviderRateLimited,
                    "Provider rate limit reached",
                    true,
                ),
                _ => AppError::new(
                    ErrorCode::ProviderNetworkError,
                    format!("Provider returned status {status}"),
                    true,
                ),
            };
        }

        AppError::new(
            ErrorCode::ProviderNetworkError,
            format!("Provider request failed: {error}"),
            true,
        )
    }
}

#[async_trait]
impl TranslateProvider for OpenAiCompatibleProvider {
    async fn translate(&self, req: TranslateRequest) -> Result<TranslateResult, AppError> {
        let timeout = if req.timeout_ms == 0 {
            DEFAULT_TIMEOUT_MS
        } else {
            req.timeout_ms
        };

        let body = ChatCompletionsRequest {
            model: self.config.model.clone(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: "You are a translation engine.".to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: self.make_prompt(&req),
                },
            ],
            temperature: 0.0,
        };

        let endpoint = format!(
            "{}/chat/completions",
            self.config.base_url.trim_end_matches('/')
        );
        let response = self
            .client
            .post(endpoint)
            .bearer_auth(&self.config.api_key)
            .timeout(Duration::from_millis(timeout))
            .json(&body)
            .send()
            .await
            .map_err(Self::map_http_error)?;

        let payload = response
            .error_for_status()
            .map_err(Self::map_http_error)?
            .json::<ChatCompletionsResponse>()
            .await
            .map_err(|err| {
                AppError::new(
                    ErrorCode::ProviderInvalidResponse,
                    format!("Invalid provider response: {err}"),
                    false,
                )
            })?;

        let translated_text = payload
            .choices
            .first()
            .map(|choice| choice.message.content.trim().to_string())
            .filter(|content| !content.is_empty())
            .ok_or_else(|| {
                AppError::new(
                    ErrorCode::ProviderInvalidResponse,
                    "Provider response has empty translation",
                    false,
                )
            })?;

        Ok(TranslateResult {
            provider_id: PROVIDER_ID.to_string(),
            source_text: req.text,
            translated_text,
            detected_source_lang: req.source_lang,
        })
    }

    fn provider_id(&self) -> &'static str {
        PROVIDER_ID
    }
}
