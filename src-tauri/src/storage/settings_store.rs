#![cfg_attr(test, allow(dead_code))]

use std::fs;
use std::path::PathBuf;

use serde_json::Value;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;

const SETTINGS_FILE_NAME: &str = "settings.json";

pub struct SettingsStore {
    path: PathBuf,
}

pub struct SettingsFileSnapshot {
    raw: Option<String>,
}

pub struct RuntimeSettingsSnapshot {
    pub primary_language: String,
    pub secondary_language: String,
    pub http_api_enabled: bool,
    pub http_api_port: u16,
}

impl SettingsStore {
    pub fn new(app_config_dir: PathBuf) -> Self {
        Self {
            path: app_config_dir.join(SETTINGS_FILE_NAME),
        }
    }

    pub fn load(&self) -> Result<Option<Value>, AppError> {
        let Some(raw) = self.read_raw()? else {
            return Ok(None);
        };
        let value = match serde_json::from_str::<Value>(&raw) {
            Ok(value) => value,
            Err(error) => {
                let backup_path = self.move_corrupted_settings_file()?;
                return Err(AppError::new(
                    ErrorCode::InternalError,
                    format!(
                        "Settings file `{}` is corrupted and was moved to `{}`: {error}. Repair or remove the backup before relaunching.",
                        self.path.display(),
                        backup_path.display()
                    ),
                    false,
                ));
            }
        };
        Ok(Some(value))
    }

    pub fn save(&self, value: &Value) -> Result<(), AppError> {
        let raw = serde_json::to_string_pretty(value).map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!("Failed to serialize settings payload: {error}"),
                false,
            )
        })?;
        self.write_raw_atomically(&raw)
    }

    pub fn snapshot(&self) -> Result<SettingsFileSnapshot, AppError> {
        Ok(SettingsFileSnapshot {
            raw: self.read_raw()?,
        })
    }

    pub fn restore(&self, snapshot: &SettingsFileSnapshot) -> Result<(), AppError> {
        if let Some(raw) = snapshot.raw.as_deref() {
            return self.write_raw_atomically(raw);
        }
        self.delete_file()
    }

    fn read_raw(&self) -> Result<Option<String>, AppError> {
        if !self.path.exists() {
            return Ok(None);
        }
        fs::read_to_string(&self.path).map(Some).map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!(
                    "Failed to read settings file `{}`: {error}",
                    self.path.display()
                ),
                false,
            )
        })
    }

    fn write_raw_atomically(&self, raw: &str) -> Result<(), AppError> {
        self.ensure_parent_dir()?;
        let temp_path = self.temporary_write_path();
        fs::write(&temp_path, raw).map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!(
                    "Failed to write temporary settings file `{}`: {error}",
                    temp_path.display()
                ),
                false,
            )
        })?;
        fs::rename(&temp_path, &self.path).map_err(|error| {
            let _ = fs::remove_file(&temp_path);
            AppError::new(
                ErrorCode::InternalError,
                format!(
                    "Failed to atomically replace settings file `{}`: {error}",
                    self.path.display()
                ),
                false,
            )
        })
    }

    fn delete_file(&self) -> Result<(), AppError> {
        if !self.path.exists() {
            return Ok(());
        }
        fs::remove_file(&self.path).map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!(
                    "Failed to remove settings file `{}` during rollback: {error}",
                    self.path.display()
                ),
                false,
            )
        })
    }

    fn ensure_parent_dir(&self) -> Result<(), AppError> {
        let Some(parent) = self.path.parent() else {
            return Err(AppError::new(
                ErrorCode::InternalError,
                "Settings path has no parent directory",
                false,
            ));
        };
        fs::create_dir_all(parent).map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!(
                    "Failed to create settings directory `{}`: {error}",
                    parent.display()
                ),
                false,
            )
        })
    }

    fn temporary_write_path(&self) -> PathBuf {
        self.path
            .with_extension(format!("json.tmp-{}", uuid::Uuid::new_v4()))
    }

    fn move_corrupted_settings_file(&self) -> Result<PathBuf, AppError> {
        let backup_path = self.path.with_extension("corrupt.json");
        if backup_path.exists() {
            fs::remove_file(&backup_path).map_err(|error| {
                AppError::new(
                    ErrorCode::InternalError,
                    format!(
                        "Failed to replace previous corrupted settings backup `{}`: {error}",
                        backup_path.display()
                    ),
                    false,
                )
            })?;
        }
        fs::rename(&self.path, &backup_path).map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!(
                    "Failed to quarantine corrupted settings file `{}`: {error}",
                    self.path.display()
                ),
                false,
            )
        })?;
        Ok(backup_path)
    }
}

pub fn extract_runtime_settings(
    value: &Value,
) -> Result<Option<RuntimeSettingsSnapshot>, AppError> {
    let Some(object) = value.as_object() else {
        return Err(AppError::new(
            ErrorCode::InternalError,
            "Settings payload must be a JSON object",
            false,
        ));
    };

    let Some(primary_language) = object.get("primaryLanguage") else {
        return Ok(None);
    };
    let Some(secondary_language) = object.get("secondaryLanguage") else {
        return Ok(None);
    };
    let Some(http_api_enabled) = object.get("httpApiEnabled") else {
        return Ok(None);
    };
    let http_api_port = object
        .get("httpApiPort")
        .map(|value| {
            value.as_u64().ok_or_else(|| {
                AppError::new(
                    ErrorCode::InternalError,
                    "Settings field `httpApiPort` must be a positive integer",
                    false,
                )
            })
        })
        .transpose()?
        .unwrap_or(61928);

    let primary_language = primary_language.as_str().ok_or_else(|| {
        AppError::new(
            ErrorCode::InternalError,
            "Settings field `primaryLanguage` must be a string",
            false,
        )
    })?;
    let secondary_language = secondary_language.as_str().ok_or_else(|| {
        AppError::new(
            ErrorCode::InternalError,
            "Settings field `secondaryLanguage` must be a string",
            false,
        )
    })?;
    let http_api_enabled = http_api_enabled.as_bool().ok_or_else(|| {
        AppError::new(
            ErrorCode::InternalError,
            "Settings field `httpApiEnabled` must be a boolean",
            false,
        )
    })?;

    Ok(Some(RuntimeSettingsSnapshot {
        primary_language: primary_language.to_string(),
        secondary_language: secondary_language.to_string(),
        http_api_enabled,
        http_api_port: u16::try_from(http_api_port).map_err(|_| {
            AppError::new(
                ErrorCode::InternalError,
                "Settings field `httpApiPort` exceeds the supported range",
                false,
            )
        })?,
    }))
}

#[cfg(test)]
#[path = "settings_store_tests.rs"]
mod tests;
