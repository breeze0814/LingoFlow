use std::env;
use std::time::Duration;

use async_trait::async_trait;
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

use crate::apiprovider::http_error::{invalid_response_error, map_http_error};
use crate::apiprovider::tencent_tmt_signer::TencentTmtSigner;
use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::providers::traits::{TranslateProvider, TranslateRequest, TranslateResult};

const PROVIDER_ID: &str = "tencent_tmt";
const PROVIDER_LABEL: &str = "Tencent TMT";
const DEFAULT_BASE_URL: &str = "https://tmt.tencentcloudapi.com";
const DEFAULT_HOST: &str = "tmt.tencentcloudapi.com";
const DEFAULT_REGION: &str = "ap-guangzhou";
const DEFAULT_TIMEOUT_MS: u64 = 15000;
const ACTION_TEXT_TRANSLATE: &str = "TextTranslate";
const API_VERSION: &str = "2018-03-21";

pub struct TencentTmtProvider {
    config: TencentTmtConfig,
    client: reqwest::Client,
}

#[derive(Clone)]
struct TencentTmtConfig {
    region: String,
    base_url: String,
    host: String,
    signer: TencentTmtSigner,
}

#[derive(Serialize)]
struct TencentTranslateBody {
    #[serde(rename = "SourceText")]
    source_text: String,
    #[serde(rename = "Source")]
    source: String,
    #[serde(rename = "Target")]
    target: String,
    #[serde(rename = "ProjectId")]
    project_id: i64,
}

#[derive(Deserialize)]
struct TencentTranslateApiResponse {
    #[serde(rename = "Response")]
    response: TencentResponseData,
}

#[derive(Deserialize)]
struct TencentResponseData {
    #[serde(rename = "Source")]
    source: Option<String>,
    #[serde(rename = "TargetText")]
    target_text: Option<String>,
    #[serde(rename = "Error")]
    error: Option<TencentApiError>,
}

#[derive(Deserialize)]
struct TencentApiError {
    #[serde(rename = "Code")]
    code: String,
    #[serde(rename = "Message")]
    message: String,
}

impl TencentTmtProvider {
    pub fn from_env() -> Option<Self> {
        let secret_id = env::var("TENCENT_TRANSLATE_SECRET_ID").ok()?;
        let secret_key = env::var("TENCENT_TRANSLATE_SECRET_KEY").ok()?;
        let region =
            env::var("TENCENT_TRANSLATE_REGION").unwrap_or_else(|_| DEFAULT_REGION.to_string());
        let base_url =
            env::var("TENCENT_TRANSLATE_BASE_URL").unwrap_or_else(|_| DEFAULT_BASE_URL.to_string());
        let host = env::var("TENCENT_TRANSLATE_HOST").unwrap_or_else(|_| DEFAULT_HOST.to_string());
        let signer = TencentTmtSigner::new(secret_id, secret_key, host.clone());
        Some(Self {
            config: TencentTmtConfig {
                region,
                base_url,
                host,
                signer,
            },
            client: reqwest::Client::new(),
        })
    }

    fn source_lang(source_lang: &str) -> String {
        let normalized = source_lang.trim().to_ascii_lowercase();
        if normalized.is_empty() {
            return "auto".to_string();
        }
        map_tencent_lang_code(&normalized, true)
    }

    fn target_lang(target_lang: &str) -> Result<String, AppError> {
        let normalized = target_lang.trim().to_ascii_lowercase();
        if normalized.is_empty() || normalized == "auto" {
            return Err(AppError::new(
                ErrorCode::InternalError,
                "Tencent target language cannot be auto",
                false,
            ));
        }
        Ok(map_tencent_lang_code(&normalized, false))
    }

    fn build_headers(&self, authorization: &str, timestamp: i64) -> Result<HeaderMap, AppError> {
        let mut headers = HeaderMap::new();
        headers.insert(
            CONTENT_TYPE,
            HeaderValue::from_static("application/json; charset=utf-8"),
        );
        headers.insert("Host", header_value(&self.config.host)?);
        headers.insert("X-TC-Action", header_value(ACTION_TEXT_TRANSLATE)?);
        headers.insert("X-TC-Version", header_value(API_VERSION)?);
        headers.insert("X-TC-Region", header_value(&self.config.region)?);
        headers.insert("X-TC-Timestamp", header_value(&timestamp.to_string())?);
        headers.insert("Authorization", header_value(authorization)?);
        Ok(headers)
    }

    fn utc_date_from_timestamp(timestamp: i64) -> Result<String, AppError> {
        let time = OffsetDateTime::from_unix_timestamp(timestamp).map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!("Tencent timestamp conversion failed: {error}"),
                false,
            )
        })?;
        Ok(format!(
            "{:04}-{:02}-{:02}",
            time.year(),
            u8::from(time.month()),
            time.day()
        ))
    }

    fn build_request_body(req: &TranslateRequest) -> Result<TencentTranslateBody, AppError> {
        Ok(TencentTranslateBody {
            source_text: req.text.clone(),
            source: Self::source_lang(&req.source_lang),
            target: Self::target_lang(&req.target_lang)?,
            project_id: 0,
        })
    }

    fn serialize_body(body: &TencentTranslateBody) -> Result<String, AppError> {
        serde_json::to_string(body).map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!("Tencent request serialize failed: {error}"),
                false,
            )
        })
    }

    fn build_signed_headers(&self, body_json: &str) -> Result<HeaderMap, AppError> {
        let timestamp = OffsetDateTime::now_utc().unix_timestamp();
        let date = Self::utc_date_from_timestamp(timestamp)?;
        let authorization = self.config.signer.build_authorization(
            ACTION_TEXT_TRANSLATE,
            timestamp,
            &date,
            body_json,
        )?;
        self.build_headers(&authorization, timestamp)
    }

    async fn request_translate(
        &self,
        headers: HeaderMap,
        body_json: String,
        timeout_ms: u64,
    ) -> Result<TencentTranslateApiResponse, AppError> {
        let response = self
            .client
            .post(&self.config.base_url)
            .headers(headers)
            .timeout(Duration::from_millis(timeout_ms))
            .body(body_json)
            .send()
            .await
            .map_err(|error| map_http_error(PROVIDER_LABEL, error))?;

        response
            .error_for_status()
            .map_err(|error| map_http_error(PROVIDER_LABEL, error))?
            .json::<TencentTranslateApiResponse>()
            .await
            .map_err(|error| invalid_response_error(PROVIDER_LABEL, error.to_string()))
    }

    fn parse_result(
        req: TranslateRequest,
        payload: TencentTranslateApiResponse,
    ) -> Result<TranslateResult, AppError> {
        if let Some(error) = payload.response.error {
            return Err(map_tencent_api_error(&error.code, &error.message));
        }
        let translated_text = payload
            .response
            .target_text
            .unwrap_or_default()
            .trim()
            .to_string();
        if translated_text.is_empty() {
            return Err(invalid_response_error(
                PROVIDER_LABEL,
                "empty translated text",
            ));
        }

        let detected_source_lang = payload
            .response
            .source
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
impl TranslateProvider for TencentTmtProvider {
    async fn translate(&self, req: TranslateRequest) -> Result<TranslateResult, AppError> {
        let timeout_ms = normalize_timeout(req.timeout_ms);
        let body = Self::build_request_body(&req)?;
        let body_json = Self::serialize_body(&body)?;
        let headers = self.build_signed_headers(&body_json)?;
        let payload = self
            .request_translate(headers, body_json, timeout_ms)
            .await?;
        Self::parse_result(req, payload)
    }

    fn provider_id(&self) -> &'static str {
        PROVIDER_ID
    }
}

fn map_tencent_api_error(code: &str, message: &str) -> AppError {
    let detail = format!("code={code}, message={message}");
    if code.contains("AuthFailure") || code.contains("InvalidSecretId") {
        return AppError::new(ErrorCode::ProviderAuthError, detail, false);
    }
    if code.contains("LimitExceeded") || code.contains("RequestLimitExceeded") {
        return AppError::new(ErrorCode::ProviderRateLimited, detail, true);
    }
    AppError::new(ErrorCode::ProviderNetworkError, detail, true)
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
            format!("Tencent header value is invalid: {error}"),
            false,
        )
    })
}

fn map_tencent_lang_code(lang: &str, is_source: bool) -> String {
    if is_source && lang == "auto" {
        return "auto".to_string();
    }
    match lang {
        "zh" | "zh-cn" => "zh".to_string(),
        "en" => "en".to_string(),
        "ja" => "jp".to_string(),
        "ko" => "kr".to_string(),
        "fr" => "fr".to_string(),
        "de" => "de".to_string(),
        other => other.to_string(),
    }
}
