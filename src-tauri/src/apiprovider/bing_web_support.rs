use reqwest::header::HeaderValue;
use serde::Deserialize;

use crate::apiprovider::http_error::invalid_response_error;
use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;

const PROVIDER_LABEL: &str = "Bing Web";

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BingPageContext {
    pub ig: String,
    pub key: String,
    pub token: String,
}

#[derive(Deserialize)]
pub(crate) struct BingTranslatePayload {
    pub translations: Option<Vec<BingTranslationItem>>,
    #[serde(rename = "detectedLanguage")]
    pub detected_language: Option<BingDetectedLanguage>,
}

#[derive(Deserialize)]
pub(crate) struct BingTranslationItem {
    pub text: String,
}

#[derive(Deserialize)]
pub(crate) struct BingDetectedLanguage {
    pub language: String,
}

#[derive(Deserialize)]
pub(crate) struct BingTranslateErrorPayload {
    #[serde(rename = "statusCode")]
    pub status_code: Option<i32>,
    #[serde(rename = "errorMessage")]
    pub error_message: Option<String>,
}

pub(crate) fn extract_page_context(html: &str) -> Result<BingPageContext, AppError> {
    let raw_params = extract_between(
        html,
        &[
            "params_AbusePreventionHelper = [",
            "params_AbusePreventionHelper=[",
        ],
        ']',
    )
    .ok_or_else(|| invalid_response_error(PROVIDER_LABEL, "missing abuse prevention params"))?;
    let mut parts = raw_params.splitn(3, ',');
    let key = parts.next().unwrap_or_default().trim().to_string();
    let token = parts
        .next()
        .unwrap_or_default()
        .trim()
        .trim_matches('"')
        .to_string();
    let ig = extract_between(html, &["\"IG\":\"", "IG:\""], '"')
        .ok_or_else(|| invalid_response_error(PROVIDER_LABEL, "missing IG parameter"))?;
    if key.is_empty() || token.is_empty() {
        return Err(invalid_response_error(
            PROVIDER_LABEL,
            "invalid abuse prevention params",
        ));
    }
    Ok(BingPageContext {
        ig,
        key,
        token,
    })
}

pub(crate) fn source_lang_to_bing(source_lang: &str) -> String {
    let normalized = source_lang.trim().to_ascii_lowercase();
    if normalized.is_empty() || normalized == "auto" {
        return "auto-detect".to_string();
    }
    map_app_to_bing_lang(&normalized)
}

pub(crate) fn target_lang_to_bing(target_lang: &str) -> Result<String, AppError> {
    let normalized = target_lang.trim().to_ascii_lowercase();
    if normalized.is_empty() || normalized == "auto" {
        return Err(AppError::new(
            ErrorCode::InternalError,
            "Bing target language cannot be auto",
            false,
        ));
    }
    Ok(map_app_to_bing_lang(&normalized))
}

pub(crate) fn map_bing_to_app_lang(lang: &str) -> String {
    match lang.trim().to_ascii_lowercase().as_str() {
        "zh-hans" | "zh" => "zh-CN".to_string(),
        "zh-hant" => "zh-TW".to_string(),
        other => other.to_string(),
    }
}

pub(crate) fn header_value(value: &str) -> Result<HeaderValue, AppError> {
    HeaderValue::from_str(value).map_err(|error| {
        AppError::new(
            ErrorCode::InternalError,
            format!("invalid Bing Web header value: {error}"),
            false,
        )
    })
}

fn extract_between(input: &str, markers: &[&str], terminator: char) -> Option<String> {
    for marker in markers {
        if let Some(start) = input.find(marker) {
            let rest = &input[start + marker.len()..];
            if let Some(end) = rest.find(terminator) {
                return Some(rest[..end].to_string());
            }
        }
    }
    None
}

fn map_app_to_bing_lang(lang: &str) -> String {
    match lang {
        "zh" | "zh-cn" => "zh-Hans".to_string(),
        "zh-tw" | "zh-hk" => "zh-Hant".to_string(),
        other => other.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_source_language_codes() {
        assert_eq!(source_lang_to_bing("auto"), "auto-detect");
        assert_eq!(source_lang_to_bing("zh-CN"), "zh-Hans");
        assert_eq!(source_lang_to_bing("zh-TW"), "zh-Hant");
        assert_eq!(source_lang_to_bing("en"), "en");
    }

    #[test]
    fn maps_target_language_codes() {
        assert_eq!(target_lang_to_bing("zh-CN").expect("zh-CN"), "zh-Hans");
        assert_eq!(target_lang_to_bing("zh-TW").expect("zh-TW"), "zh-Hant");
        assert_eq!(target_lang_to_bing("ja").expect("ja"), "ja");
        assert!(target_lang_to_bing("auto").is_err());
    }

    #[test]
    fn extracts_abuse_prevention_context_from_html() {
        let html = r#"
            <script>
              var params_AbusePreventionHelper = [1775456913563,"4EIQmDwOrsrkCAqPLbaIlXvlzynJHqwK",3600000];
              var config = {"IG":"3519F97DA9EE4C79A33EE3355E1E2A6A"};
            </script>
        "#;

        let context = extract_page_context(html).expect("context should parse");

        assert_eq!(context.key, "1775456913563");
        assert_eq!(context.token, "4EIQmDwOrsrkCAqPLbaIlXvlzynJHqwK");
        assert_eq!(context.ig, "3519F97DA9EE4C79A33EE3355E1E2A6A");
    }
}
