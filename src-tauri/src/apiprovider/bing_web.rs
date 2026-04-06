use std::env;
use std::process::Command;

use async_trait::async_trait;

use crate::apiprovider::bing_web_support::{
    extract_page_context, map_bing_to_app_lang, source_lang_to_bing, target_lang_to_bing,
    BingPageContext, BingTranslateErrorPayload, BingTranslatePayload,
};
use crate::apiprovider::http_error::{invalid_response_error, map_http_error};
use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::providers::traits::{TranslateProvider, TranslateRequest, TranslateResult};

const PROVIDER_ID: &str = "bing_web";
const PROVIDER_LABEL: &str = "Bing Web";
const DEFAULT_BASE_URL: &str = "https://www.bing.com";
const DEFAULT_TRANSLATOR_URL: &str = "https://www.bing.com/translator";
const DEFAULT_CURL_PATH: &str = "curl.exe";
const DEFAULT_USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";
const DEFAULT_TIMEOUT_MS: u64 = 15000;
const DEFAULT_IID: &str = "translator.5028";

pub struct BingWebProvider {
    config: BingWebConfig,
}

struct BingWebConfig {
    base_url: String,
    translator_url: String,
    user_agent: String,
    curl_path: String,
}

impl BingWebProvider {
    pub fn from_env() -> Option<Self> {
        Some(Self {
            config: BingWebConfig {
                base_url: env::var("BING_WEB_BASE_URL")
                    .unwrap_or_else(|_| DEFAULT_BASE_URL.to_string()),
                translator_url: env::var("BING_WEB_TRANSLATOR_URL")
                    .unwrap_or_else(|_| DEFAULT_TRANSLATOR_URL.to_string()),
                user_agent: env::var("BING_WEB_USER_AGENT")
                    .unwrap_or_else(|_| DEFAULT_USER_AGENT.to_string()),
                curl_path: env::var("BING_WEB_CURL_PATH")
                    .unwrap_or_else(|_| DEFAULT_CURL_PATH.to_string()),
            },
        })
    }

    async fn fetch_page_context(&self, timeout_ms: u64) -> Result<BingPageContext, AppError> {
        log_bing_web(format!(
            "fetch_page_context start url={} timeout_ms={timeout_ms}",
            self.config.translator_url
        ));
        let (status_line, html) = self.run_curl_and_collect(&[
            "-s",
            "-L",
            "-A",
            self.config.user_agent.as_str(),
            self.config.translator_url.as_str(),
            "-w",
            "\n%{http_code}",
        ])?;
        log_bing_web(format!(
            "fetch_page_context ok status={} html_len={} html_preview={}",
            status_line,
            html.len(),
            preview(&html)
        ));
        let context = extract_page_context(&html)?;
        log_bing_web(format!(
            "page_context ig={} key_len={} token_len={}",
            context.ig,
            context.key.len(),
            context.token.len()
        ));
        Ok(context)
    }

    async fn request_translation(
        &self,
        req: &TranslateRequest,
        source_lang: &str,
        target_lang: &str,
        timeout_ms: u64,
        context: &BingPageContext,
    ) -> Result<String, AppError> {
        let endpoint = format!(
            "{}/ttranslatev3",
            self.config.base_url.trim_end_matches('/')
        );
        log_bing_web(format!(
            "request_translation start endpoint={} source_lang={} target_lang={} text_len={} text_preview={} ig={} token_len={} key_len={}",
            endpoint,
            source_lang,
            target_lang,
            req.text.len(),
            preview_debug(&req.text),
            context.ig,
            context.token.len(),
            context.key.len()
        ));
        let request_url = format!(
            "{}?isVertical=1&IG={}&IID={}",
            endpoint, context.ig, DEFAULT_IID
        );
        let data_args = vec![
            "--data-urlencode".to_string(),
            format!("fromLang={source_lang}"),
            "--data-urlencode".to_string(),
            format!("to={target_lang}"),
            "--data-urlencode".to_string(),
            format!("text={}", req.text),
            "--data-urlencode".to_string(),
            "tryFetchingGenderDebiasedTranslations=true".to_string(),
            "--data-urlencode".to_string(),
            format!("token={}", context.token),
            "--data-urlencode".to_string(),
            format!("key={}", context.key),
        ];
        let mut args = vec![
            "-s".to_string(),
            "-L".to_string(),
            "--post302".to_string(),
            "-X".to_string(),
            "POST".to_string(),
            request_url,
            "-H".to_string(),
            format!("User-Agent: {}", self.config.user_agent),
            "-H".to_string(),
            format!("Referer: {}", self.config.translator_url),
            "-H".to_string(),
            format!("Origin: {}", self.config.base_url.trim_end_matches('/')),
            "-H".to_string(),
            "Content-Type: application/x-www-form-urlencoded".to_string(),
        ];
        args.extend(data_args);
        args.push("-w".to_string());
        args.push("\n%{http_code}|%header{content-length}|%header{content-type}|%header{content-encoding}|%header{set-cookie}".to_string());
        let (meta, body) = self.run_curl_and_collect_owned(&args)?;
        log_bing_web(format!(
            "request_translation ok status={} body_len={} body_preview={}",
            meta,
            body.len(),
            preview(&body)
        ));
        Ok(body)
    }

    fn parse_translation_result(
        req: TranslateRequest,
        payload_text: &str,
    ) -> Result<TranslateResult, AppError> {
        log_bing_web(format!(
            "parse_translation_result body_len={} body_preview={}",
            payload_text.len(),
            preview(payload_text)
        ));
        if payload_text.trim().is_empty() {
            return Err(invalid_response_error(
                PROVIDER_LABEL,
                "empty response body",
            ));
        }
        if payload_text.trim_start().starts_with('{') {
            let payload = serde_json::from_str::<BingTranslateErrorPayload>(payload_text)
                .map_err(|error| invalid_response_error(PROVIDER_LABEL, error.to_string()))?;
            let detail = payload
                .status_code
                .map(|status| format!("status code {status}"))
                .unwrap_or_else(|| payload.error_message.unwrap_or_default());
            return Err(invalid_response_error(
                PROVIDER_LABEL,
                format!("translate failed: {detail}"),
            ));
        }

        let payload = serde_json::from_str::<Vec<BingTranslatePayload>>(payload_text)
            .map_err(|error| invalid_response_error(PROVIDER_LABEL, error.to_string()))?;
        let first = payload
            .iter()
            .find(|item| item.translations.as_ref().is_some_and(|items| !items.is_empty()))
            .ok_or_else(|| invalid_response_error(PROVIDER_LABEL, "missing translation item"))?;
        let translation = first
            .translations
            .as_ref()
            .and_then(|items| items.first())
            .ok_or_else(|| invalid_response_error(PROVIDER_LABEL, "missing translations"))?;
        let translated_text = translation.text.trim().to_string();
        if translated_text.is_empty() {
            return Err(invalid_response_error(
                PROVIDER_LABEL,
                "empty translated text",
            ));
        }

        let detected_source_lang = first
            .detected_language
            .as_ref()
            .map(|value| map_bing_to_app_lang(&value.language))
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
impl TranslateProvider for BingWebProvider {
    async fn translate(&self, req: TranslateRequest) -> Result<TranslateResult, AppError> {
        let timeout_ms = normalize_timeout(req.timeout_ms);
        let source_lang = source_lang_to_bing(&req.source_lang);
        let target_lang = target_lang_to_bing(&req.target_lang)?;
        let context = self.fetch_page_context(timeout_ms).await?;
        let payload = self
            .request_translation(&req, &source_lang, &target_lang, timeout_ms, &context)
            .await?;
        Self::parse_translation_result(req, &payload)
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

fn log_bing_web(message: String) {
    if cfg!(debug_assertions) || env::var("BING_WEB_DEBUG").ok().as_deref() == Some("1") {
        eprintln!("[bing_web] {message}");
    }
}

fn preview(value: &str) -> String {
    let trimmed = value.replace(['\r', '\n'], " ");
    let preview: String = trimmed.chars().take(160).collect();
    if trimmed.chars().count() > 160 {
        format!("{preview}...")
    } else {
        preview
    }
}

fn preview_debug(value: &str) -> String {
    let escaped = format!("{value:?}");
    let preview: String = escaped.chars().take(160).collect();
    if escaped.chars().count() > 160 {
        format!("{preview}...")
    } else {
        preview
    }
}

impl BingWebProvider {
    fn run_curl_and_collect(&self, args: &[&str]) -> Result<(String, String), AppError> {
        self.run_curl_and_collect_owned(&args.iter().map(|value| value.to_string()).collect::<Vec<String>>())
    }

    fn run_curl_and_collect_owned(&self, args: &[String]) -> Result<(String, String), AppError> {
        let output = Command::new(&self.config.curl_path)
            .args(args)
            .output()
            .map_err(|error| {
                AppError::new(
                    ErrorCode::ProviderNetworkError,
                    format!("Bing Web failed to launch curl: {error}"),
                    true,
                )
            })?;
        if !output.status.success() {
            return Err(AppError::new(
                ErrorCode::ProviderNetworkError,
                format!(
                    "Bing Web curl failed with status {:?}: {}",
                    output.status.code(),
                    String::from_utf8_lossy(&output.stderr).trim()
                ),
                true,
            ));
        }
        let stdout = String::from_utf8(output.stdout)
            .map_err(|error| invalid_response_error(PROVIDER_LABEL, error.to_string()))?;
        let (body, meta) = stdout.rsplit_once('\n').ok_or_else(|| {
            invalid_response_error(PROVIDER_LABEL, "curl response missing status footer")
        })?;
        Ok((meta.to_string(), body.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_id_is_bing_web() {
        let provider = BingWebProvider::from_env().expect("provider should use default config");
        assert_eq!(provider.provider_id(), "bing_web");
    }

    #[test]
    fn default_user_agent_looks_like_browser() {
        let provider = BingWebProvider::from_env().expect("provider should use default config");
        assert!(provider.config.user_agent.contains("Chrome/146.0.0.0"));
    }

    #[test]
    fn curl_path_has_default() {
        let provider = BingWebProvider::from_env().expect("provider should use default config");
        assert!(!provider.config.curl_path.is_empty());
    }

    #[test]
    fn parse_translation_result_ignores_transliteration_sidecar_item() {
        let result = BingWebProvider::parse_translation_result(
            TranslateRequest {
                text: "hello".to_string(),
                source_lang: "zh-CN".to_string(),
                target_lang: "en".to_string(),
                timeout_ms: 15000,
            },
            r#"[{"translations":[{"text":"hello","to":"en"}],"usedLLM":true,"detectedLanguage":{"language":"en"}},{"inputTransliteration":"埃洛","script":"Hans"}]"#,
        )
        .expect("bing payload should parse");

        assert_eq!(result.translated_text, "hello");
        assert_eq!(result.detected_source_lang, "en");
    }
}
