use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;

#[cfg(target_os = "macos")]
use crate::platform::macos_helper::{run_helper, HelperError};

#[cfg(target_os = "macos")]
const HELPER_COMMAND: &str = "selection.read";

#[cfg(target_os = "macos")]
const SELECTED_TEXT_KEY: &str = "selectedText";

#[cfg(target_os = "macos")]
pub fn read_selected_text() -> Result<String, AppError> {
    let response = run_helper(HELPER_COMMAND, None)?;
    if !response.ok {
        return Err(map_helper_error(response.error));
    }

    let data = response.data.ok_or_else(|| {
        AppError::new(
            ErrorCode::ProviderInvalidResponse,
            "Selection helper response missing data",
            false,
        )
    })?;
    let selected_text = data
        .get(SELECTED_TEXT_KEY)
        .map(String::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    if selected_text.is_empty() {
        return Err(AppError::new(
            ErrorCode::NoSelection,
            "未检测到选中文本",
            false,
        ));
    }
    Ok(selected_text)
}

#[cfg(target_os = "macos")]
fn map_helper_error(error: Option<HelperError>) -> AppError {
    let code = error
        .as_ref()
        .and_then(|item| item.code.as_deref())
        .unwrap_or("selection_failed");
    let message = error
        .as_ref()
        .and_then(|item| item.message.as_deref())
        .unwrap_or("Selection helper execution failed")
        .to_string();
    let retryable = error
        .as_ref()
        .and_then(|item| item.retryable)
        .unwrap_or(true);

    if code == "permission_denied" {
        return AppError::new(ErrorCode::PermissionDenied, message, false);
    }
    if code == "no_selection" {
        return AppError::new(ErrorCode::NoSelection, message, false);
    }
    if code == "invalid_request" {
        return AppError::new(ErrorCode::ProviderInvalidResponse, message, false);
    }
    AppError::new(ErrorCode::InternalError, message, retryable)
}

#[cfg(not(target_os = "macos"))]
pub fn read_selected_text() -> Result<String, AppError> {
    Err(AppError::new(
        ErrorCode::InternalError,
        "Selection reading is only implemented on macOS",
        false,
    ))
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::map_helper_error;
    use crate::errors::error_code::ErrorCode;
    use crate::platform::macos_helper::HelperError;

    #[test]
    fn maps_no_selection_code() {
        let error = map_helper_error(Some(HelperError {
            code: Some("no_selection".to_string()),
            message: Some("missing selection".to_string()),
            retryable: Some(false),
        }));
        assert!(matches!(error.code, ErrorCode::NoSelection));
    }

    #[test]
    fn maps_permission_denied_code() {
        let error = map_helper_error(Some(HelperError {
            code: Some("permission_denied".to_string()),
            message: Some("permission denied".to_string()),
            retryable: Some(false),
        }));
        assert!(matches!(error.code, ErrorCode::PermissionDenied));
    }
}
