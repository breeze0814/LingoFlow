use std::env;
use std::time::Duration;

use async_trait::async_trait;
use serde::Deserialize;
use uuid::Uuid;

use crate::apiprovider::http_error::{invalid_response_error, map_http_error};
use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::providers::traits::{TranslateProvider, TranslateRequest, TranslateResult};

const PROVIDER_ID: &str = "baidu_fanyi";
const PROVIDER_LABEL: &str = "Baidu Fanyi";
const DEFAULT_BASE_URL: &str = "https://fanyi-api.baidu.com/api/trans/vip/translate";
const DEFAULT_TIMEOUT_MS: u64 = 15000;

pub struct BaiduFanyiProvider {
    config: BaiduFanyiConfig,
    client: reqwest::Client,
}

#[derive(Clone)]
struct BaiduFanyiConfig {
    app_id: String,
    secret: String,
    base_url: String,
}

#[derive(Deserialize)]
struct BaiduTranslateResponse {
    trans_result: Option<Vec<BaiduTranslationItem>>,
    error_code: Option<String>,
    error_msg: Option<String>,
}

#[derive(Deserialize)]
struct BaiduTranslationItem {
    dst: String,
    src: String,
}

impl BaiduFanyiProvider {
    pub fn from_env() -> Option<Self> {
        let app_id = env::var("BAIDU_TRANSLATE_APP_ID").ok()?;
        let secret = env::var("BAIDU_TRANSLATE_SECRET").ok()?;
        let base_url =
            env::var("BAIDU_TRANSLATE_BASE_URL").unwrap_or_else(|_| DEFAULT_BASE_URL.to_string());
        Some(Self {
            config: BaiduFanyiConfig {
                app_id,
                secret,
                base_url,
            },
            client: reqwest::Client::new(),
        })
    }

    fn source_lang(source_lang: &str) -> String {
        let normalized = source_lang.trim().to_ascii_lowercase();
        if normalized.is_empty() {
            return "auto".to_string();
        }
        map_baidu_lang_code(&normalized, true)
    }

    fn target_lang(target_lang: &str) -> Result<String, AppError> {
        let normalized = target_lang.trim().to_ascii_lowercase();
        if normalized.is_empty() || normalized == "auto" {
            return Err(AppError::new(
                ErrorCode::InternalError,
                "Baidu target language cannot be auto",
                false,
            ));
        }
        Ok(map_baidu_lang_code(&normalized, false))
    }

    fn sign(&self, text: &str, salt: &str) -> String {
        let raw = format!(
            "{}{}{}{}",
            self.config.app_id, text, salt, self.config.secret
        );
        format!("{:x}", md5::compute(raw))
    }

    fn build_query(
        &self,
        req: &TranslateRequest,
        salt: String,
    ) -> Result<Vec<(String, String)>, AppError> {
        let sign = self.sign(&req.text, &salt);
        Ok(vec![
            ("q".to_string(), req.text.clone()),
            ("from".to_string(), Self::source_lang(&req.source_lang)),
            ("to".to_string(), Self::target_lang(&req.target_lang)?),
            ("appid".to_string(), self.config.app_id.clone()),
            ("salt".to_string(), salt),
            ("sign".to_string(), sign),
        ])
    }

    async fn request_translate(
        &self,
        query: &[(String, String)],
        timeout_ms: u64,
    ) -> Result<BaiduTranslateResponse, AppError> {
        let response = self
            .client
            .get(&self.config.base_url)
            .timeout(Duration::from_millis(timeout_ms))
            .query(query)
            .send()
            .await
            .map_err(|error| map_http_error(PROVIDER_LABEL, error))?;

        response
            .error_for_status()
            .map_err(|error| map_http_error(PROVIDER_LABEL, error))?
            .json::<BaiduTranslateResponse>()
            .await
            .map_err(|error| invalid_response_error(PROVIDER_LABEL, error.to_string()))
    }

    fn parse_result(
        req: TranslateRequest,
        payload: BaiduTranslateResponse,
    ) -> Result<TranslateResult, AppError> {
        if let Some(error_code) = payload.error_code {
            return Err(map_baidu_api_error(
                &error_code,
                payload.error_msg.unwrap_or_default(),
            ));
        }
        let first = payload
            .trans_result
            .and_then(|items| items.into_iter().next())
            .ok_or_else(|| invalid_response_error(PROVIDER_LABEL, "missing translation result"))?;
        let translated_text = first.dst.trim().to_string();
        if translated_text.is_empty() {
            return Err(invalid_response_error(
                PROVIDER_LABEL,
                "empty translated text",
            ));
        }

        Ok(TranslateResult {
            provider_id: PROVIDER_ID.to_string(),
            source_text: req.text,
            translated_text,
            detected_source_lang: first.src,
        })
    }
}

#[async_trait]
impl TranslateProvider for BaiduFanyiProvider {
    async fn translate(&self, req: TranslateRequest) -> Result<TranslateResult, AppError> {
        let timeout_ms = normalize_timeout(req.timeout_ms);
        let salt = Uuid::new_v4().simple().to_string();
        let query = self.build_query(&req, salt)?;
        let payload = self.request_translate(&query, timeout_ms).await?;
        Self::parse_result(req, payload)
    }

    fn provider_id(&self) -> &'static str {
        PROVIDER_ID
    }
}

fn map_baidu_api_error(error_code: &str, message: String) -> AppError {
    let detail = format!("code={error_code}, message={message}");
    match error_code {
        "52003" => AppError::new(ErrorCode::ProviderAuthError, detail, false),
        "54003" => AppError::new(ErrorCode::ProviderRateLimited, detail, true),
        _ => AppError::new(ErrorCode::ProviderNetworkError, detail, true),
    }
}

fn normalize_timeout(timeout_ms: u64) -> u64 {
    if timeout_ms == 0 {
        DEFAULT_TIMEOUT_MS
    } else {
        timeout_ms
    }
}

fn map_baidu_lang_code(lang: &str, is_source: bool) -> String {
    if is_source && lang == "auto" {
        return "auto".to_string();
    }
    match lang {
        "zh" | "zh-cn" => "zh".to_string(),
        "en" => "en".to_string(),
        "ja" => "jp".to_string(),
        "ko" => "kor".to_string(),
        "fr" => "fra".to_string(),
        "de" => "de".to_string(),
        other => other.to_string(),
    }
}
