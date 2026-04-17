use std::env;
use std::time::Duration;

use async_trait::async_trait;
use reqwest::header::{HeaderMap, HeaderValue, COOKIE, REFERER, USER_AGENT};

use crate::apiprovider::http_error::{invalid_response_error, map_http_error};
use crate::apiprovider::youdao_web_support::{
    current_millis_string, decrypt_payload, flatten_translated_text, generate_sign,
    source_lang_to_youdao, target_lang_to_youdao, YoudaoSignParams, YoudaoWebKeyData,
    YoudaoWebKeyResponse, YoudaoWebTranslateResponse,
};
use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::providers::traits::{TranslateProvider, TranslateRequest, TranslateResult};

const PROVIDER_ID: &str = "youdao_web";
const PROVIDER_LABEL: &str = "Youdao Web";
const DEFAULT_REFERER: &str = "https://fanyi.youdao.com";
const DEFAULT_USER_AGENT: &str = "Mozilla/5.0";
const DEFAULT_COOKIE: &str = "OUTFOX_SEARCH_USER_ID=1796239350@10.110.96.157;";
const DEFAULT_TIMEOUT_MS: u64 = 15000;

const YOUDAO_CLIENT: &str = "fanyideskweb";
const YOUDAO_PRODUCT: &str = "webfanyi";
const YOUDAO_APP_VERSION: &str = "1.0.0";
const YOUDAO_VENDOR: &str = "web";
const YOUDAO_POINT_PARAM: &str = "client,mysticTime,product";
const YOUDAO_KEY_FROM: &str = "fanyi.web";
const YOUDAO_DEFAULT_KEY: &str = "asdjnjfenknafdfsdfsd";
const YOUDAO_KEY_ID_GETTER: &str = "webfanyi-key-getter";
const YOUDAO_KEY_ID_TRANSLATE: &str = "webfanyi";
const YOUDAO_KEY_ENDPOINT: &str = "https://dict.youdao.com/webtranslate/key";
const YOUDAO_TRANSLATE_ENDPOINT: &str = "https://dict.youdao.com/webtranslate";

pub struct YoudaoWebProvider {
    config: YoudaoWebConfig,
    client: reqwest::Client,
}

struct YoudaoWebConfig {
    referer: String,
    user_agent: String,
    cookie: String,
    key_endpoint: String,
    translate_endpoint: String,
}

/// Request context for Youdao translation
struct YoudaoTranslationContext<'a> {
    req: &'a TranslateRequest,
    source_lang: &'a str,
    target_lang: &'a str,
    timeout_ms: u64,
    secret_key: &'a str,
}

impl YoudaoWebProvider {
    pub fn from_env() -> Option<Self> {
        Some(Self {
            config: YoudaoWebConfig {
                referer: env::var("YOUDAO_WEB_REFERER")
                    .unwrap_or_else(|_| DEFAULT_REFERER.to_string()),
                user_agent: env::var("YOUDAO_WEB_USER_AGENT")
                    .unwrap_or_else(|_| DEFAULT_USER_AGENT.to_string()),
                cookie: env::var("YOUDAO_WEB_COOKIE")
                    .unwrap_or_else(|_| DEFAULT_COOKIE.to_string()),
                key_endpoint: env::var("YOUDAO_WEB_KEY_ENDPOINT")
                    .unwrap_or_else(|_| YOUDAO_KEY_ENDPOINT.to_string()),
                translate_endpoint: env::var("YOUDAO_WEB_TRANSLATE_ENDPOINT")
                    .unwrap_or_else(|_| YOUDAO_TRANSLATE_ENDPOINT.to_string()),
            },
            client: reqwest::Client::new(),
        })
    }

    fn headers(&self) -> Result<HeaderMap, AppError> {
        let mut headers = HeaderMap::new();
        headers.insert(USER_AGENT, header_value(&self.config.user_agent)?);
        headers.insert(REFERER, header_value(&self.config.referer)?);
        headers.insert(COOKIE, header_value(&self.config.cookie)?);
        Ok(headers)
    }

    fn general_parameters(timestamp: &str) -> Vec<(String, String)> {
        vec![
            ("client".to_string(), YOUDAO_CLIENT.to_string()),
            ("product".to_string(), YOUDAO_PRODUCT.to_string()),
            ("appVersion".to_string(), YOUDAO_APP_VERSION.to_string()),
            ("vendor".to_string(), YOUDAO_VENDOR.to_string()),
            ("pointParam".to_string(), YOUDAO_POINT_PARAM.to_string()),
            ("keyfrom".to_string(), YOUDAO_KEY_FROM.to_string()),
            ("mysticTime".to_string(), timestamp.to_string()),
        ]
    }

    async fn request_web_key(
        &self,
        timeout_ms: u64,
        timestamp: &str,
    ) -> Result<YoudaoWebKeyData, AppError> {
        let mut parameters = Self::general_parameters(timestamp);
        parameters.push(("keyid".to_string(), YOUDAO_KEY_ID_GETTER.to_string()));
        parameters.push((
            "sign".to_string(),
            generate_sign(YoudaoSignParams {
                client: YOUDAO_CLIENT,
                product: YOUDAO_PRODUCT,
                timestamp,
                key: YOUDAO_DEFAULT_KEY,
            }),
        ));
        let response = self
            .client
            .get(&self.config.key_endpoint)
            .headers(self.headers()?)
            .query(&parameters)
            .timeout(Duration::from_millis(timeout_ms))
            .send()
            .await
            .map_err(|error| map_http_error(PROVIDER_LABEL, error))?;
        let payload = response
            .error_for_status()
            .map_err(|error| map_http_error(PROVIDER_LABEL, error))?
            .json::<YoudaoWebKeyResponse>()
            .await
            .map_err(|error| invalid_response_error(PROVIDER_LABEL, error.to_string()))?;
        if payload.code != 0 {
            return Err(invalid_response_error(
                PROVIDER_LABEL,
                format!(
                    "failed to request web key: {}",
                    payload.msg.unwrap_or_default()
                ),
            ));
        }
        payload
            .data
            .ok_or_else(|| invalid_response_error(PROVIDER_LABEL, "missing web key data"))
    }

    async fn request_translation(
        &self,
        ctx: YoudaoTranslationContext<'_>,
    ) -> Result<String, AppError> {
        let timestamp = current_millis_string()?;
        let mut parameters = Self::general_parameters(&timestamp);
        parameters.push(("i".to_string(), ctx.req.text.clone()));
        parameters.push(("from".to_string(), ctx.source_lang.to_string()));
        parameters.push(("to".to_string(), ctx.target_lang.to_string()));
        parameters.push(("dictResult".to_string(), "false".to_string()));
        parameters.push(("keyid".to_string(), YOUDAO_KEY_ID_TRANSLATE.to_string()));
        parameters.push((
            "sign".to_string(),
            generate_sign(YoudaoSignParams {
                client: YOUDAO_CLIENT,
                product: YOUDAO_PRODUCT,
                timestamp: &timestamp,
                key: ctx.secret_key,
            }),
        ));
        let response = self
            .client
            .post(&self.config.translate_endpoint)
            .headers(self.headers()?)
            .form(&parameters)
            .timeout(Duration::from_millis(ctx.timeout_ms))
            .send()
            .await
            .map_err(|error| map_http_error(PROVIDER_LABEL, error))?;
        let encrypted_payload = response
            .error_for_status()
            .map_err(|error| map_http_error(PROVIDER_LABEL, error))?
            .text()
            .await
            .map_err(|error| invalid_response_error(PROVIDER_LABEL, error.to_string()))?;
        if encrypted_payload.trim().is_empty() {
            return Err(invalid_response_error(
                PROVIDER_LABEL,
                "empty encrypted payload",
            ));
        }
        Ok(encrypted_payload)
    }

    fn parse_translation_result(
        _req: TranslateRequest,
        decrypted_payload: &str,
    ) -> Result<TranslateResult, AppError> {
        let payload = serde_json::from_str::<YoudaoWebTranslateResponse>(decrypted_payload)
            .map_err(|error| invalid_response_error(PROVIDER_LABEL, error.to_string()))?;
        if payload.code != 0 {
            return Err(invalid_response_error(
                PROVIDER_LABEL,
                format!("translate failed: {}", payload.msg.unwrap_or_default()),
            ));
        }
        let translated_text = flatten_translated_text(payload.translate_result)?;
        Ok(TranslateResult { translated_text })
    }
}

#[async_trait]
impl TranslateProvider for YoudaoWebProvider {
    async fn translate(&self, req: TranslateRequest) -> Result<TranslateResult, AppError> {
        let timeout_ms = normalize_timeout(req.timeout_ms);
        let source_lang = source_lang_to_youdao(&req.source_lang);
        let target_lang = target_lang_to_youdao(&req.target_lang)?;
        let key_timestamp = current_millis_string()?;
        let key_data = self.request_web_key(timeout_ms, &key_timestamp).await?;

        let ctx = YoudaoTranslationContext {
            req: &req,
            source_lang: &source_lang,
            target_lang: &target_lang,
            timeout_ms,
            secret_key: &key_data.secret_key,
        };

        let encrypted_payload = self.request_translation(ctx).await?;
        let decrypted_payload =
            decrypt_payload(&encrypted_payload, &key_data.aes_key, &key_data.aes_iv)?;
        Self::parse_translation_result(req, &decrypted_payload)
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
            format!("Youdao header value is invalid: {error}"),
            false,
        )
    })
}
