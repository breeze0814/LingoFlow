use std::env;
use std::time::Duration;

use async_trait::async_trait;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, CONTENT_TYPE};
use serde::{Deserialize, Serialize};

use crate::apiprovider::http_error::{invalid_response_error, map_http_error};
use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::providers::traits::{TranslateProvider, TranslateRequest, TranslateResult};

const PROVIDER_ID: &str = "azure_translator";
const PROVIDER_LABEL: &str = "Azure Translator";
pub(crate) const DEFAULT_BASE_URL: &str = "https://api.cognitive.microsofttranslator.com";
const DEFAULT_TIMEOUT_MS: u64 = 15000;

pub struct MicrosoftTranslatorProvider {
    pub(crate) config: MicrosoftTranslatorConfig,
    pub(crate) client: reqwest::Client,
}

#[derive(Clone)]
pub(crate) struct MicrosoftTranslatorConfig {
    pub(crate) api_key: String,
    pub(crate) region: Option<String>,
    pub(crate) base_url: String,
}

#[derive(Serialize)]
struct AzureTranslateBodyItem {
    #[serde(rename = "Text")]
    text: String,
}

#[derive(Deserialize)]
struct AzureTranslateResponseItem {
    #[serde(rename = "detectedLanguage")]
    detected_language: Option<AzureDetectedLanguage>,
    translations: Vec<AzureTranslationItem>,
}

#[derive(Deserialize)]
struct AzureDetectedLanguage {
    language: String,
}

#[derive(Deserialize)]
struct AzureTranslationItem {
    text: String,
}

impl MicrosoftTranslatorProvider {
    pub fn from_env() -> Option<Self> {
        let api_key = env::var("AZURE_TRANSLATOR_KEY").ok()?;
        let region = env::var("AZURE_TRANSLATOR_REGION").ok();
        let base_url =
            env::var("AZURE_TRANSLATOR_BASE_URL").unwrap_or_else(|_| DEFAULT_BASE_URL.to_string());
        Some(Self {
            config: MicrosoftTranslatorConfig {
                api_key,
                region,
                base_url,
            },
            client: reqwest::Client::new(),
        })
    }

    fn build_headers(&self) -> Result<HeaderMap, AppError> {
        let mut headers = HeaderMap::new();
        headers.insert(
            HeaderName::from_static("ocp-apim-subscription-key"),
            header_value(&self.config.api_key)?,
        );
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        if let Some(region) = &self.config.region {
            headers.insert(
                HeaderName::from_static("ocp-apim-subscription-region"),
                header_value(region)?,
            );
        }
        Ok(headers)
    }

    fn source_lang(source_lang: &str) -> Option<String> {
        let normalized = source_lang.trim().to_ascii_lowercase();
        if normalized.is_empty() || normalized == "auto" {
            return None;
        }
        Some(map_azure_lang_code(&normalized))
    }

    fn target_lang(target_lang: &str) -> Result<String, AppError> {
        let normalized = target_lang.trim().to_ascii_lowercase();
        if normalized.is_empty() || normalized == "auto" {
            return Err(AppError::new(
                ErrorCode::InternalError,
                "Azure target language cannot be auto",
                false,
            ));
        }
        Ok(map_azure_lang_code(&normalized))
    }

    fn build_query(&self, req: &TranslateRequest) -> Result<Vec<(String, String)>, AppError> {
        let mut query = vec![
            ("api-version".to_string(), "3.0".to_string()),
            ("to".to_string(), Self::target_lang(&req.target_lang)?),
        ];
        if let Some(source_lang) = Self::source_lang(&req.source_lang) {
            query.push(("from".to_string(), source_lang));
        }
        Ok(query)
    }

    async fn request_translate(
        &self,
        req: &TranslateRequest,
        query: &[(String, String)],
        timeout_ms: u64,
    ) -> Result<Vec<AzureTranslateResponseItem>, AppError> {
        let endpoint = format!("{}/translate", self.config.base_url.trim_end_matches('/'));
        let headers = self.build_headers()?;
        let body = vec![AzureTranslateBodyItem {
            text: req.text.clone(),
        }];
        let response = self
            .client
            .post(endpoint)
            .headers(headers)
            .query(query)
            .timeout(Duration::from_millis(timeout_ms))
            .json(&body)
            .send()
            .await
            .map_err(|error| map_http_error(PROVIDER_LABEL, error))?;

        response
            .error_for_status()
            .map_err(|error| map_http_error(PROVIDER_LABEL, error))?
            .json::<Vec<AzureTranslateResponseItem>>()
            .await
            .map_err(|error| invalid_response_error(PROVIDER_LABEL, error.to_string()))
    }

    fn parse_result(
        req: TranslateRequest,
        payload: Vec<AzureTranslateResponseItem>,
    ) -> Result<TranslateResult, AppError> {
        let first_item = payload
            .first()
            .ok_or_else(|| invalid_response_error(PROVIDER_LABEL, "missing response item"))?;
        let translation = first_item
            .translations
            .first()
            .ok_or_else(|| invalid_response_error(PROVIDER_LABEL, "missing translation item"))?;
        let translated_text = translation.text.trim().to_string();
        if translated_text.is_empty() {
            return Err(invalid_response_error(
                PROVIDER_LABEL,
                "empty translated text",
            ));
        }

        let detected_source_lang = first_item
            .detected_language
            .as_ref()
            .map(|item| item.language.clone())
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
impl TranslateProvider for MicrosoftTranslatorProvider {
    async fn translate(&self, req: TranslateRequest) -> Result<TranslateResult, AppError> {
        let timeout_ms = normalize_timeout(req.timeout_ms);
        let query = self.build_query(&req)?;
        let payload = self.request_translate(&req, &query, timeout_ms).await?;
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

fn header_value(value: &str) -> Result<HeaderValue, AppError> {
    HeaderValue::from_str(value).map_err(|error| {
        AppError::new(
            ErrorCode::InternalError,
            format!("Azure header value is invalid: {error}"),
            false,
        )
    })
}

fn map_azure_lang_code(lang: &str) -> String {
    match lang {
        "zh-cn" | "zh" => "zh-Hans".to_string(),
        "en" => "en".to_string(),
        "ja" => "ja".to_string(),
        "ko" => "ko".to_string(),
        "fr" => "fr".to_string(),
        "de" => "de".to_string(),
        other => other.to_string(),
    }
}
