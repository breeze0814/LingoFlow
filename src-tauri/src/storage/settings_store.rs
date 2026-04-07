use std::fs;
use std::path::PathBuf;

use serde_json::Value;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;

const SETTINGS_FILE_NAME: &str = "settings.json";

pub struct SettingsStore {
    path: PathBuf,
}

pub struct RuntimeSettingsSnapshot {
    pub primary_language: String,
    pub secondary_language: String,
    pub http_api_enabled: bool,
}

impl SettingsStore {
    pub fn new(app_config_dir: PathBuf) -> Self {
        Self {
            path: app_config_dir.join(SETTINGS_FILE_NAME),
        }
    }

    pub fn load(&self) -> Result<Option<Value>, AppError> {
        if !self.path.exists() {
            return Ok(None);
        }
        let raw = fs::read_to_string(&self.path).map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!("Failed to read settings file `{}`: {error}", self.path.display()),
                false,
            )
        })?;
        let value = serde_json::from_str::<Value>(&raw).map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!("Failed to parse settings file `{}`: {error}", self.path.display()),
                false,
            )
        })?;
        Ok(Some(value))
    }

    pub fn save(&self, value: &Value) -> Result<(), AppError> {
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
                format!("Failed to create settings directory `{}`: {error}", parent.display()),
                false,
            )
        })?;
        let raw = serde_json::to_string_pretty(value).map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!("Failed to serialize settings payload: {error}"),
                false,
            )
        })?;
        fs::write(&self.path, raw).map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!("Failed to write settings file `{}`: {error}", self.path.display()),
                false,
            )
        })
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
    }))
}
