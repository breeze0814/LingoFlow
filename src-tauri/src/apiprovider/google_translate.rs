use std::env;
use std::time::Duration;

use async_trait::async_trait;
use serde::Deserialize;

use crate::apiprovider::http_error::{invalid_response_error, map_http_error};
use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::providers::traits::{TranslateProvider, TranslateRequest, TranslateResult};

const PROVIDER_ID: &str = "google_translate";
const PROVIDER_LABEL: &str = "Google Translate";
pub(crate) const DEFAULT_BASE_URL: &str =
    "https://translation.googleapis.com/language/translate/v2";
const DEFAULT_TIMEOUT_MS: u64 = 15000;

pub struct GoogleTranslateProvider {
    pub(crate) config: GoogleTranslateConfig,
    pub(crate) client: reqwest::Client,
}

#[derive(Clone)]
pub(crate) struct GoogleTranslateConfig {
    pub(crate) api_key: String,
    pub(crate) base_url: String,
}

#[derive(Deserialize)]
struct GoogleTranslateResponse {
    data: GoogleTranslateData,
}

#[derive(Deserialize)]
struct GoogleTranslateData {
    translations: Vec<GoogleTranslationItem>,
}

#[derive(Deserialize)]
struct GoogleTranslationItem {
    #[serde(rename = "translatedText")]
    translated_text: String,
}

impl GoogleTranslateProvider {
    pub fn from_env() -> Option<Self> {
        let api_key = env::var("GOOGLE_TRANSLATE_API_KEY").ok()?;
        let base_url =
            env::var("GOOGLE_TRANSLATE_BASE_URL").unwrap_or_else(|_| DEFAULT_BASE_URL.to_string());
        Some(Self {
            config: GoogleTranslateConfig { api_key, base_url },
            client: reqwest::Client::new(),
        })
    }

    fn source_lang(source_lang: &str) -> Option<String> {
        let normalized = source_lang.trim().to_ascii_lowercase();
        if normalized.is_empty() || normalized == "auto" {
            return None;
        }
        Some(map_google_lang_code(&normalized))
    }

    fn target_lang(target_lang: &str) -> Result<String, AppError> {
        let normalized = target_lang.trim().to_ascii_lowercase();
        if normalized.is_empty() || normalized == "auto" {
            return Err(AppError::new(
                ErrorCode::InternalError,
                "Google target language cannot be auto",
                false,
            ));
        }
        Ok(map_google_lang_code(&normalized))
    }

    fn build_form_data(&self, req: &TranslateRequest) -> Result<Vec<(String, String)>, AppError> {
        let mut form_data = vec![
            ("key".to_string(), self.config.api_key.clone()),
            ("q".to_string(), req.text.clone()),
            ("target".to_string(), Self::target_lang(&req.target_lang)?),
            ("format".to_string(), "text".to_string()),
        ];
        if let Some(source_lang) = Self::source_lang(&req.source_lang) {
            form_data.push(("source".to_string(), source_lang));
        }
        Ok(form_data)
    }

    async fn request_translate(
        &self,
        form_data: &[(String, String)],
        timeout_ms: u64,
    ) -> Result<GoogleTranslateResponse, AppError> {
        let response = self
            .client
            .post(&self.config.base_url)
            .timeout(Duration::from_millis(timeout_ms))
            .form(form_data)
            .send()
            .await
            .map_err(|error| map_http_error(PROVIDER_LABEL, error))?;

        response
            .error_for_status()
            .map_err(|error| map_http_error(PROVIDER_LABEL, error))?
            .json::<GoogleTranslateResponse>()
            .await
            .map_err(|error| invalid_response_error(PROVIDER_LABEL, error.to_string()))
    }

    fn parse_result(
        _req: TranslateRequest,
        payload: GoogleTranslateResponse,
    ) -> Result<TranslateResult, AppError> {
        let first_translation = payload
            .data
            .translations
            .first()
            .ok_or_else(|| invalid_response_error(PROVIDER_LABEL, "missing translations"))?;
        let translated_text = first_translation.translated_text.trim().to_string();
        if translated_text.is_empty() {
            return Err(invalid_response_error(
                PROVIDER_LABEL,
                "empty translated text",
            ));
        }

        Ok(TranslateResult { translated_text })
    }
}

#[async_trait]
impl TranslateProvider for GoogleTranslateProvider {
    async fn translate(&self, req: TranslateRequest) -> Result<TranslateResult, AppError> {
        let timeout_ms = normalize_timeout(req.timeout_ms);
        let form_data = self.build_form_data(&req)?;
        let payload = self.request_translate(&form_data, timeout_ms).await?;
        Self::parse_result(req, payload)
    }

    fn provider_id(&self) -> &'static str {
        PROVIDER_ID
    }
}

fn normalize_timeout(timeout_ms: u64) -> u64 {
    if timeout_ms == 0 {
        DEFAULT_TIMEOUT_MS
    } else {
        timeout_ms
    }
}

fn map_google_lang_code(lang: &str) -> String {
    match lang {
        "zh" | "zh-cn" => "zh-CN".to_string(),
        "en" => "en".to_string(),
        "ja" => "ja".to_string(),
        "ko" => "ko".to_string(),
        "fr" => "fr".to_string(),
        "de" => "de".to_string(),
        other => other.to_string(),
    }
}
