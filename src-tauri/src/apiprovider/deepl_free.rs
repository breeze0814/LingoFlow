use std::env;
use std::time::Duration;

use async_trait::async_trait;
use serde::Deserialize;

use crate::apiprovider::http_error::{invalid_response_error, map_http_error};
use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::providers::traits::{TranslateProvider, TranslateRequest, TranslateResult};

const PROVIDER_ID: &str = "deepl_free";
const PROVIDER_LABEL: &str = "DeepL";
pub(crate) const DEFAULT_BASE_URL: &str = "https://api-free.deepl.com/v2/translate";
const DEFAULT_TIMEOUT_MS: u64 = 15000;

pub struct DeepLFreeProvider {
    pub(crate) config: DeepLConfig,
    pub(crate) client: reqwest::Client,
}

#[derive(Clone)]
pub(crate) struct DeepLConfig {
    pub(crate) api_key: String,
    pub(crate) base_url: String,
}

#[derive(Deserialize)]
struct DeepLResponse {
    translations: Vec<DeepLTranslationItem>,
}

#[derive(Deserialize)]
struct DeepLTranslationItem {
    text: String,
    detected_source_language: Option<String>,
}

impl DeepLFreeProvider {
    pub fn from_env() -> Option<Self> {
        let api_key = env::var("DEEPL_API_KEY").ok()?;
        let base_url = env::var("DEEPL_BASE_URL").unwrap_or_else(|_| DEFAULT_BASE_URL.to_string());
        Some(Self {
            config: DeepLConfig { api_key, base_url },
            client: reqwest::Client::new(),
        })
    }

    fn build_source_lang(source_lang: &str) -> Option<String> {
        let normalized = source_lang.trim().to_ascii_lowercase();
        if normalized == "auto" || normalized.is_empty() {
            return None;
        }
        Some(map_deepl_lang_code(&normalized))
    }

    fn build_target_lang(target_lang: &str) -> Result<String, AppError> {
        let normalized = target_lang.trim().to_ascii_lowercase();
        if normalized == "auto" || normalized.is_empty() {
            return Err(AppError::new(
                ErrorCode::InternalError,
                "DeepL target language cannot be auto",
                false,
            ));
        }
        Ok(map_deepl_lang_code(&normalized))
    }

    fn build_form_data(&self, req: &TranslateRequest) -> Result<Vec<(String, String)>, AppError> {
        let target_lang = Self::build_target_lang(&req.target_lang)?;
        let mut form_data = vec![
            ("text".to_string(), req.text.clone()),
            ("target_lang".to_string(), target_lang),
        ];
        if let Some(source_lang) = Self::build_source_lang(&req.source_lang) {
            form_data.push(("source_lang".to_string(), source_lang));
        }
        Ok(form_data)
    }

    async fn request_translate(
        &self,
        form_data: &[(String, String)],
        timeout_ms: u64,
    ) -> Result<DeepLResponse, AppError> {
        let response = self
            .client
            .post(&self.config.base_url)
            .header(
                "Authorization",
                format!("DeepL-Auth-Key {}", self.config.api_key),
            )
            .timeout(Duration::from_millis(timeout_ms))
            .form(form_data)
            .send()
            .await
            .map_err(|error| map_http_error(PROVIDER_LABEL, error))?;

        response
            .error_for_status()
            .map_err(|error| map_http_error(PROVIDER_LABEL, error))?
            .json::<DeepLResponse>()
            .await
            .map_err(|error| invalid_response_error(PROVIDER_LABEL, error.to_string()))
    }

    fn parse_result(
        payload: DeepLResponse,
        req: TranslateRequest,
    ) -> Result<TranslateResult, AppError> {
        let first = payload
            .translations
            .first()
            .ok_or_else(|| invalid_response_error(PROVIDER_LABEL, "missing translations"))?;
        let translated_text = first.text.trim().to_string();
        if translated_text.is_empty() {
            return Err(invalid_response_error(
                PROVIDER_LABEL,
                "empty translated text",
            ));
        }

        let detected_source_lang = first
            .detected_source_language
            .clone()
            .unwrap_or_else(|| req.source_lang.clone());

        Ok(TranslateResult {
            provider_id: PROVIDER_ID.to_string(),
            source_text: req.text,
            translated_text,
            detected_source_lang,
        })
    }
}

#[async_trait]
impl TranslateProvider for DeepLFreeProvider {
    async fn translate(&self, req: TranslateRequest) -> Result<TranslateResult, AppError> {
        let timeout_ms = normalize_timeout(req.timeout_ms);
        let form_data = self.build_form_data(&req)?;
        let payload = self.request_translate(&form_data, timeout_ms).await?;
        Self::parse_result(payload, req)
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

fn map_deepl_lang_code(lang: &str) -> String {
    match lang {
        "zh-cn" | "zh" => "ZH".to_string(),
        "en" => "EN".to_string(),
        "ja" => "JA".to_string(),
        "ko" => "KO".to_string(),
        "fr" => "FR".to_string(),
        "de" => "DE".to_string(),
        other => other.to_ascii_uppercase(),
    }
}
