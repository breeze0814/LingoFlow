use serde_json::Value;
use tauri::State;

use crate::app_state::AppState;
use crate::errors::app_error::AppError;
use crate::runtime_settings_sync::{RuntimeSettingsDeps, RuntimeSettingsInput};
use crate::settings_secret_fields::SECRET_FIELD_SPECS;
use crate::storage::keychain_store::KeychainStore;
use crate::storage::settings_store::{extract_runtime_settings, SettingsFileSnapshot};

#[derive(Clone)]
struct SecretSnapshotEntry {
    key: &'static str,
    value: Option<String>,
}

#[tauri::command]
pub fn load_settings(state: State<'_, AppState>) -> Result<Option<Value>, AppError> {
    crate::settings_persistence::load_settings(&state.settings_store, &state.keychain_store)
}

#[tauri::command]
pub async fn save_settings(state: State<'_, AppState>, payload: Value) -> Result<(), AppError> {
    let settings_snapshot = state.settings_store.snapshot()?;
    let secret_snapshot = snapshot_keychain_secrets(&state.keychain_store)?;
    crate::settings_persistence::save_settings(
        &state.settings_store,
        &state.keychain_store,
        &payload,
    )?;
    let runtime_settings = extract_runtime_settings(&payload)?;
    if let Some(runtime_settings) = runtime_settings {
        let sync_result = crate::runtime_settings_sync::sync_runtime_settings(
            RuntimeSettingsDeps {
                config_store: state.config_store.clone(),
                http_server_controller: state.http_server_controller.clone(),
                http_api_state: state.http_api_state.clone(),
            },
            RuntimeSettingsInput {
                http_api_enabled: runtime_settings.http_api_enabled,
                http_api_port: runtime_settings.http_api_port,
                source_lang: runtime_settings.primary_language,
                target_lang: runtime_settings.secondary_language,
            },
        )
        .await;
        if let Err(sync_error) = sync_result {
            return Err(rollback_after_runtime_sync_failure(
                &state,
                &settings_snapshot,
                &secret_snapshot,
                sync_error,
            ));
        }
    }
    Ok(())
}

fn snapshot_keychain_secrets(
    keychain_store: &KeychainStore,
) -> Result<Vec<SecretSnapshotEntry>, AppError> {
    SECRET_FIELD_SPECS
        .iter()
        .map(|spec| {
            Ok(SecretSnapshotEntry {
                key: spec.secret_key,
                value: keychain_store.get(spec.secret_key)?,
            })
        })
        .collect()
}

fn restore_keychain_snapshot(
    keychain_store: &KeychainStore,
    snapshot: &[SecretSnapshotEntry],
) -> Result<(), AppError> {
    for entry in snapshot {
        if let Some(value) = entry.value.as_deref() {
            keychain_store.set(entry.key, value)?;
        } else {
            keychain_store.delete(entry.key)?;
        }
    }
    Ok(())
}

fn rollback_after_runtime_sync_failure(
    state: &AppState,
    settings_snapshot: &SettingsFileSnapshot,
    secret_snapshot: &[SecretSnapshotEntry],
    sync_error: AppError,
) -> AppError {
    let settings_restore_error = state.settings_store.restore(settings_snapshot).err();
    let keychain_restore_error = restore_keychain_snapshot(&state.keychain_store, secret_snapshot).err();
    if settings_restore_error.is_none() && keychain_restore_error.is_none() {
        return sync_error;
    }

    let mut message = format!("{}; rollback attempted", sync_error.message);
    if let Some(error) = settings_restore_error {
        message.push_str(&format!("; settings restore failed: {}", error.message));
    }
    if let Some(error) = keychain_restore_error {
        message.push_str(&format!("; keychain restore failed: {}", error.message));
    }
    AppError::new(sync_error.code, message, sync_error.retryable)
}
