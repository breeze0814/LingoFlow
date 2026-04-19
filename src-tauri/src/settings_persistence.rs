use serde_json::Value;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::settings_secret_fields::{
    collect_secret_field_updates, inject_secret_field, SecretFieldUpdate, SECRET_FIELD_SPECS,
};
use crate::storage::keychain_store::KeychainStore;
use crate::storage::settings_store::{SettingsFileSnapshot, SettingsStore};

#[derive(Clone)]
struct SecretSnapshot {
    secret_key: &'static str,
    value: Option<String>,
}

pub fn load_settings(
    settings_store: &SettingsStore,
    keychain_store: &KeychainStore,
) -> Result<Option<Value>, AppError> {
    let Some(mut settings) = settings_store.load()? else {
        return Ok(None);
    };
    inject_secret_fields(keychain_store, &mut settings)?;
    Ok(Some(settings))
}

pub fn save_settings(
    settings_store: &SettingsStore,
    keychain_store: &KeychainStore,
    payload: &Value,
) -> Result<(), AppError> {
    ensure_object_payload(payload)?;

    let mut redacted = payload.clone();
    let updates = collect_secret_field_updates(payload, &mut redacted)?;
    let file_snapshot = settings_store.snapshot()?;
    let secret_snapshot = snapshot_secret_fields(keychain_store)?;

    settings_store.save(&redacted)?;
    if let Err(error) = apply_secret_updates(keychain_store, &updates) {
        return Err(rollback_failed_save(RollbackContext {
            settings_store,
            keychain_store,
            file_snapshot: &file_snapshot,
            secret_snapshot: &secret_snapshot,
            error,
        }));
    }
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

fn inject_secret_fields(
    keychain_store: &KeychainStore,
    payload: &mut Value,
) -> Result<(), AppError> {
    for spec in SECRET_FIELD_SPECS {
        if let Some(value) = keychain_store.get(spec.secret_key)? {
            inject_secret_field(payload, spec.path, value)?;
        }
    }
    Ok(())
}

fn snapshot_secret_fields(keychain_store: &KeychainStore) -> Result<Vec<SecretSnapshot>, AppError> {
    SECRET_FIELD_SPECS
        .into_iter()
        .map(|spec| {
            Ok(SecretSnapshot {
                secret_key: spec.secret_key,
                value: keychain_store.get(spec.secret_key)?,
            })
        })
        .collect()
}

fn apply_secret_updates(
    keychain_store: &KeychainStore,
    updates: &[SecretFieldUpdate<'static>],
) -> Result<(), AppError> {
    for update in updates {
        if let Some(value) = update.value.as_deref() {
            keychain_store.set(update.secret_key, value)?;
            continue;
        }
        keychain_store.delete(update.secret_key)?;
    }
    Ok(())
}

fn restore_secret_snapshot(
    keychain_store: &KeychainStore,
    snapshot: &[SecretSnapshot],
) -> Result<(), AppError> {
    for entry in snapshot {
        if let Some(value) = entry.value.as_deref() {
            keychain_store.set(entry.secret_key, value)?;
            continue;
        }
        keychain_store.delete(entry.secret_key)?;
    }
    Ok(())
}

struct RollbackContext<'a> {
    settings_store: &'a SettingsStore,
    keychain_store: &'a KeychainStore,
    file_snapshot: &'a SettingsFileSnapshot,
    secret_snapshot: &'a [SecretSnapshot],
    error: AppError,
}

fn rollback_failed_save(context: RollbackContext) -> AppError {
    let file_restore_error = context.settings_store.restore(context.file_snapshot).err();
    let secret_restore_error =
        restore_secret_snapshot(context.keychain_store, context.secret_snapshot).err();
    if file_restore_error.is_none() && secret_restore_error.is_none() {
        return context.error;
    }

    let mut message = format!("{}; rollback attempted", context.error.message);
    if let Some(restore_error) = file_restore_error {
        message.push_str(&format!(
            "; settings restore failed: {}",
            restore_error.message
        ));
    }
    if let Some(restore_error) = secret_restore_error {
        message.push_str(&format!(
            "; keychain restore failed: {}",
            restore_error.message
        ));
    }
    AppError::new(context.error.code, message, context.error.retryable)
}

#[cfg(test)]
mod tests {
    use std::io::ErrorKind;
    use std::path::PathBuf;

    use serde_json::json;

    use super::{load_settings, save_settings};
    use crate::settings_secret_fields::SECRET_FIELD_SPECS;
    use crate::storage::keychain_store::KeychainStore;
    use crate::storage::settings_store::SettingsStore;

    fn test_store() -> (SettingsStore, PathBuf) {
        let root = std::env::temp_dir().join(format!(
            "lingoflow-settings-persistence-test-{}",
            uuid::Uuid::new_v4()
        ));
        (SettingsStore::new(root.clone()), root)
    }

    fn cleanup_test_dir(root: PathBuf) {
        if let Err(error) = std::fs::remove_dir_all(root) {
            assert_eq!(
                error.kind(),
                ErrorKind::NotFound,
                "cleanup test dir: {error}"
            );
        }
    }

    fn sample_payload(api_key: &str, language: &str) -> serde_json::Value {
        json!({
            "primaryLanguage": language,
            "secondaryLanguage": "zh-CN",
            "httpApiEnabled": true,
            "httpApiPort": 61928,
            "providers": {
                "openai_compatible_ocr": {"apiKey": "", "baseUrl": "", "model": ""},
                "openai_compatible": {"apiKey": api_key, "baseUrl": "", "model": ""},
                "deepl_free": {"apiKey": ""},
                "azure_translator": {"apiKey": ""},
                "google_translate": {"apiKey": ""},
                "tencent_tmt": {"secretId": "", "secretKey": ""},
                "baidu_fanyi": {"appId": "", "appSecret": ""}
            }
        })
    }

    #[test]
    fn invalid_payload_leaves_file_and_keychain_untouched() {
        let (settings_store, root) = test_store();
        let keychain_store = KeychainStore::new("test");

        let error = save_settings(&settings_store, &keychain_store, &json!(null))
            .expect_err("non-object payload should fail");

        assert!(error.message.contains("JSON object"));
        assert_eq!(settings_store.load().expect("load settings"), None);
        assert_eq!(
            keychain_store
                .get(SECRET_FIELD_SPECS[1].secret_key)
                .expect("read keychain"),
            None
        );
        cleanup_test_dir(root);
    }

    #[test]
    fn save_persists_redacted_file_and_injects_secrets_on_load() {
        let (settings_store, root) = test_store();
        let keychain_store = KeychainStore::new("test");

        save_settings(
            &settings_store,
            &keychain_store,
            &sample_payload("secret-key", "en"),
        )
        .expect("persist settings");

        let stored = settings_store
            .load()
            .expect("load redacted settings")
            .expect("stored settings should exist");
        assert_eq!(stored["providers"]["openai_compatible"]["apiKey"], "");

        let hydrated = load_settings(&settings_store, &keychain_store)
            .expect("load hydrated settings")
            .expect("hydrated settings should exist");
        assert_eq!(
            hydrated["providers"]["openai_compatible"]["apiKey"],
            "secret-key"
        );
        cleanup_test_dir(root);
    }

    #[test]
    fn rolls_back_file_and_keychain_when_secret_write_fails() {
        let (settings_store, root) = test_store();
        let keychain_store = KeychainStore::new("test");
        let secret_key = SECRET_FIELD_SPECS[1].secret_key;

        save_settings(
            &settings_store,
            &keychain_store,
            &sample_payload("old-secret", "en"),
        )
        .expect("save original settings");
        keychain_store.fail_on_set(secret_key);

        let error = save_settings(
            &settings_store,
            &keychain_store,
            &sample_payload("new-secret", "ja"),
        )
        .expect_err("failing keychain write should abort save");

        assert!(error.message.contains("Injected keychain set failure"));
        let restored = load_settings(&settings_store, &keychain_store)
            .expect("load restored settings")
            .expect("restored settings should exist");
        assert_eq!(restored["primaryLanguage"], "en");
        assert_eq!(
            restored["providers"]["openai_compatible"]["apiKey"],
            "old-secret"
        );
        cleanup_test_dir(root);
    }
}
