use serde_json::Value;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;

pub const SECRET_FIELD_SPECS: [SecretFieldSpec; 9] = [
    SecretFieldSpec::new(
        "openai_compatible_ocr",
        "apiKey",
        "lingoflow.provider.openai_compatible_ocr.api_key",
    ),
    SecretFieldSpec::new(
        "openai_compatible",
        "apiKey",
        "lingoflow.provider.openai_compatible.api_key",
    ),
    SecretFieldSpec::new(
        "deepl_free",
        "apiKey",
        "lingoflow.provider.deepl_free.api_key",
    ),
    SecretFieldSpec::new(
        "azure_translator",
        "apiKey",
        "lingoflow.provider.azure_translator.api_key",
    ),
    SecretFieldSpec::new(
        "google_translate",
        "apiKey",
        "lingoflow.provider.google_translate.api_key",
    ),
    SecretFieldSpec::new(
        "tencent_tmt",
        "secretId",
        "lingoflow.provider.tencent_tmt.secret_id",
    ),
    SecretFieldSpec::new(
        "tencent_tmt",
        "secretKey",
        "lingoflow.provider.tencent_tmt.secret_key",
    ),
    SecretFieldSpec::new(
        "baidu_fanyi",
        "appId",
        "lingoflow.provider.baidu_fanyi.app_id",
    ),
    SecretFieldSpec::new(
        "baidu_fanyi",
        "appSecret",
        "lingoflow.provider.baidu_fanyi.secret",
    ),
];

#[derive(Clone, Copy)]
pub struct ProviderFieldPath<'a> {
    pub provider_id: &'a str,
    pub field_name: &'a str,
}

#[derive(Clone, Copy)]
pub struct SecretFieldSpec<'a> {
    pub path: ProviderFieldPath<'a>,
    pub secret_key: &'a str,
}

#[cfg_attr(test, allow(dead_code))]
#[derive(Debug)]
pub struct SecretFieldUpdate<'a> {
    pub secret_key: &'a str,
    pub value: Option<String>,
}

impl<'a> SecretFieldSpec<'a> {
    pub const fn new(provider_id: &'a str, field_name: &'a str, secret_key: &'a str) -> Self {
        Self {
            path: ProviderFieldPath {
                provider_id,
                field_name,
            },
            secret_key,
        }
    }
}

pub fn collect_secret_field_updates(
    full_payload: &Value,
    redacted_payload: &mut Value,
) -> Result<Vec<SecretFieldUpdate<'static>>, AppError> {
    let mut updates = Vec::with_capacity(SECRET_FIELD_SPECS.len());
    for spec in SECRET_FIELD_SPECS {
        let value = provider_field(full_payload, spec.path).unwrap_or_default();
        set_provider_field(redacted_payload, spec.path, String::new())?;
        updates.push(SecretFieldUpdate {
            secret_key: spec.secret_key,
            value: normalize_secret_value(&value),
        });
    }
    Ok(updates)
}

#[cfg_attr(test, allow(dead_code))]
pub fn inject_secret_field(
    payload: &mut Value,
    path: ProviderFieldPath<'static>,
    value: String,
) -> Result<(), AppError> {
    set_provider_field(payload, path, value)
}

fn provider_field(payload: &Value, path: ProviderFieldPath<'_>) -> Option<String> {
    payload
        .get("providers")
        .and_then(Value::as_object)
        .and_then(|providers| providers.get(path.provider_id))
        .and_then(Value::as_object)
        .and_then(|provider| provider.get(path.field_name))
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn normalize_secret_value(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.to_string())
}

fn set_provider_field(
    payload: &mut Value,
    path: ProviderFieldPath<'_>,
    value: String,
) -> Result<(), AppError> {
    let providers = payload
        .get_mut("providers")
        .and_then(Value::as_object_mut)
        .ok_or_else(|| {
            AppError::new(
                ErrorCode::InternalError,
                "Settings payload missing `providers` object",
                false,
            )
        })?;
    let provider = providers
        .get_mut(path.provider_id)
        .and_then(Value::as_object_mut)
        .ok_or_else(|| {
            AppError::new(
                ErrorCode::InternalError,
                format!("Settings payload missing provider `{}`", path.provider_id),
                false,
            )
        })?;
    provider.insert(path.field_name.to_string(), Value::String(value));
    Ok(())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{collect_secret_field_updates, normalize_secret_value};

    #[test]
    fn normalizes_secret_value_by_trimming_and_dropping_empty_strings() {
        assert_eq!(
            normalize_secret_value("  secret  "),
            Some("secret".to_string())
        );
        assert_eq!(normalize_secret_value("   "), None);
    }

    #[test]
    fn collects_secret_updates_after_validating_all_provider_paths() {
        let payload = json!({
            "providers": {
                "openai_compatible_ocr": {"apiKey": "ocr-key"},
                "openai_compatible": {"apiKey": "translate-key"},
                "deepl_free": {"apiKey": ""},
                "azure_translator": {"apiKey": ""},
                "google_translate": {"apiKey": ""},
                "tencent_tmt": {"secretId": "", "secretKey": ""},
                "baidu_fanyi": {"appId": "", "appSecret": ""}
            }
        });
        let mut redacted = payload.clone();

        let updates =
            collect_secret_field_updates(&payload, &mut redacted).expect("collect secret updates");

        assert_eq!(updates.len(), 9);
        assert_eq!(
            redacted["providers"]["openai_compatible_ocr"]["apiKey"],
            serde_json::Value::String(String::new())
        );
        assert_eq!(
            redacted["providers"]["openai_compatible"]["apiKey"],
            serde_json::Value::String(String::new())
        );
    }

    #[test]
    fn rejects_invalid_payload_before_returning_secret_updates() {
        let payload = json!({
            "providers": {
                "openai_compatible": {"apiKey": "translate-key"}
            }
        });
        let mut redacted = payload.clone();

        let error = collect_secret_field_updates(&payload, &mut redacted)
            .expect_err("missing provider entries should fail validation");

        assert!(error.message.contains("openai_compatible_ocr"));
    }
}
