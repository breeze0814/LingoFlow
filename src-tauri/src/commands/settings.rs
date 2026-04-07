use serde_json::Value;
use tauri::State;

use crate::app_state::AppState;
use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;

const SECRET_FIELD_SPECS: [SecretFieldSpec; 7] = [
    SecretFieldSpec::new("deepl_free", "apiKey", "lingoflow.provider.deepl_free.api_key"),
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
    SecretFieldSpec::new("baidu_fanyi", "appId", "lingoflow.provider.baidu_fanyi.app_id"),
    SecretFieldSpec::new(
        "baidu_fanyi",
        "appSecret",
        "lingoflow.provider.baidu_fanyi.secret",
    ),
];

#[derive(Clone, Copy)]
struct ProviderFieldPath<'a> {
    provider_id: &'a str,
    field_name: &'a str,
}

#[derive(Clone, Copy)]
struct SecretFieldSpec<'a> {
    path: ProviderFieldPath<'a>,
    secret_key: &'a str,
}

impl<'a> SecretFieldSpec<'a> {
    const fn new(provider_id: &'a str, field_name: &'a str, secret_key: &'a str) -> Self {
        Self {
            path: ProviderFieldPath {
                provider_id,
                field_name,
            },
            secret_key,
        }
    }
}

#[tauri::command]
pub fn load_settings(state: State<'_, AppState>) -> Result<Option<Value>, AppError> {
    let Some(mut settings) = state.settings_store.load()? else {
        return Ok(None);
    };
    inject_secret_fields(&state, &mut settings)?;
    Ok(Some(settings))
}

#[tauri::command]
pub fn save_settings(state: State<'_, AppState>, payload: Value) -> Result<(), AppError> {
    ensure_object_payload(&payload)?;
    let mut redacted = payload.clone();
    persist_secret_fields(&state, &payload, &mut redacted)?;
    state.settings_store.save(&redacted)?;
    Ok(())
}

fn ensure_object_payload(payload: &Value) -> Result<(), AppError> {
    if payload.is_object() {
        return Ok(());
    }
    Err(AppError::new(
        ErrorCode::InternalError,
        "Settings payload must be a JSON object",
        false,
    ))
}

fn persist_secret_fields(
    state: &State<'_, AppState>,
    full_payload: &Value,
    redacted_payload: &mut Value,
) -> Result<(), AppError> {
    for spec in SECRET_FIELD_SPECS {
        let value = provider_field(full_payload, spec.path).unwrap_or_default();
        if value.trim().is_empty() {
            state.keychain_store.delete(spec.secret_key)?;
        } else {
            state.keychain_store.set(spec.secret_key, value.trim())?;
        }
        set_provider_field(redacted_payload, spec.path, String::new())?;
    }
    Ok(())
}

fn inject_secret_fields(state: &State<'_, AppState>, payload: &mut Value) -> Result<(), AppError> {
    for spec in SECRET_FIELD_SPECS {
        if let Some(value) = state.keychain_store.get(spec.secret_key)? {
            set_provider_field(payload, spec.path, value)?;
        }
    }
    Ok(())
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

fn set_provider_field(payload: &mut Value, path: ProviderFieldPath<'_>, value: String) -> Result<(), AppError> {
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
