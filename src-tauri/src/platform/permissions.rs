#![cfg_attr(test, allow(dead_code))]

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PermissionState {
    Unknown,
    Granted,
    Denied,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PermissionStatus {
    pub accessibility: PermissionState,
    pub screen_recording: PermissionState,
}

#[cfg(target_os = "macos")]
pub fn read_permission_status() -> Result<PermissionStatus, AppError> {
    let response = crate::platform::macos_helper::run_helper("permission.get_status", None)?;
    if !response.ok {
        let message = response
            .error
            .and_then(|error| error.message)
            .unwrap_or_else(|| "Permission helper execution failed".to_string());
        return Err(AppError::new(ErrorCode::InternalError, message, true));
    }
    let data = response.data.ok_or_else(|| {
        AppError::new(
            ErrorCode::ProviderInvalidResponse,
            "Permission helper response missing data",
            false,
        )
    })?;
    Ok(PermissionStatus {
        accessibility: parse_permission_state(data.get("accessibility").map(String::as_str))?,
        screen_recording: parse_permission_state(data.get("screen_recording").map(String::as_str))?,
    })
}

#[cfg(not(target_os = "macos"))]
pub fn read_permission_status() -> Result<PermissionStatus, AppError> {
    Ok(PermissionStatus {
        accessibility: PermissionState::Unknown,
        screen_recording: PermissionState::Unknown,
    })
}

#[allow(dead_code)]
fn parse_permission_state(value: Option<&str>) -> Result<PermissionState, AppError> {
    match value.unwrap_or("unknown") {
        "granted" => Ok(PermissionState::Granted),
        "denied" => Ok(PermissionState::Denied),
        "unknown" => Ok(PermissionState::Unknown),
        other => Err(AppError::new(
            ErrorCode::ProviderInvalidResponse,
            format!("Unsupported permission state `{other}`"),
            false,
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::{PermissionState, PermissionStatus};

    #[test]
    fn serializes_permission_status_using_camel_case() {
        let payload = serde_json::to_value(PermissionStatus {
            accessibility: PermissionState::Granted,
            screen_recording: PermissionState::Denied,
        })
        .expect("serialize permission status");

        assert_eq!(
            payload
                .get("accessibility")
                .and_then(|value| value.as_str()),
            Some("granted")
        );
        assert_eq!(
            payload
                .get("screenRecording")
                .and_then(|value| value.as_str()),
            Some("denied")
        );
        assert!(payload.get("screen_recording").is_none());
    }
}
