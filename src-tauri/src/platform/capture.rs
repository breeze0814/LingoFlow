use std::path::PathBuf;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::orchestrator::models::CaptureRect;
#[cfg(target_os = "macos")]
use crate::platform::macos_helper::{run_helper, HelperError, HelperPayload};
#[cfg(all(target_os = "windows", not(test)))]
use crate::platform::windows_capture::{
    capture_region_image, launch_screenclip, wait_for_clipboard_image,
};

#[cfg(target_os = "macos")]
const HELPER_COMMAND: &str = "capture.start_interactive";

#[cfg(target_os = "macos")]
const IMAGE_PATH_KEY: &str = "imagePath";

pub fn capture_interactive_image() -> Result<(PathBuf, Option<CaptureRect>), AppError> {
    let output_path = build_capture_output_path();
    run_capture_command(&output_path)?;
    let path = ensure_capture_file_exists(output_path)?;
    Ok((path, None))
}

pub fn capture_region_image_file(
    capture_rect: &CaptureRect,
) -> Result<(PathBuf, CaptureRect), AppError> {
    let output_path = build_capture_output_path();
    run_region_capture_command(&output_path, capture_rect)?;
    let path = ensure_capture_file_exists(output_path)?;
    Ok((path, capture_rect.clone()))
}

fn build_capture_output_path() -> PathBuf {
    let file_name = format!("lingoflow-capture-{}.png", uuid::Uuid::new_v4());
    std::env::temp_dir().join(file_name)
}

fn ensure_capture_file_exists(output_path: PathBuf) -> Result<PathBuf, AppError> {
    if output_path.exists() {
        return Ok(output_path);
    }
    Err(AppError::new(
        ErrorCode::InternalError,
        "Capture command finished without output image",
        false,
    ))
}

#[cfg(target_os = "macos")]
fn run_capture_command(output_path: &PathBuf) -> Result<(), AppError> {
    let response = run_helper(
        HELPER_COMMAND,
        Some(HelperPayload {
            image_path: Some(output_path.to_string_lossy().into_owned()),
            source_lang_hint: None,
        }),
    )?;
    if !response.ok {
        return Err(map_macos_capture_error(response.error));
    }
    let data = response.data.ok_or_else(|| {
        AppError::new(
            ErrorCode::ProviderInvalidResponse,
            "Capture helper response missing data",
            false,
        )
    })?;
    let image_path = data
        .get(IMAGE_PATH_KEY)
        .map(String::as_str)
        .unwrap_or_default()
        .trim();
    if image_path.is_empty() {
        return Err(AppError::new(
            ErrorCode::ProviderInvalidResponse,
            "Capture helper response missing image path",
            false,
        ));
    }
    if image_path == output_path.to_string_lossy() {
        return Ok(());
    }
    Err(AppError::new(
        ErrorCode::ProviderInvalidResponse,
        format!("Capture helper returned unexpected image path: {image_path}"),
        false,
    ))
}

#[cfg(all(target_os = "windows", not(test)))]
fn run_region_capture_command(
    output_path: &std::path::Path,
    capture_rect: &CaptureRect,
) -> Result<(), AppError> {
    capture_region_image(output_path, capture_rect)
}

#[cfg(any(test, not(target_os = "windows")))]
fn run_region_capture_command(
    _output_path: &std::path::Path,
    _capture_rect: &CaptureRect,
) -> Result<(), AppError> {
    Err(AppError::new(
        ErrorCode::InternalError,
        "Direct region capture is only implemented on Windows",
        false,
    ))
}

#[cfg(all(target_os = "windows", not(test)))]
fn run_capture_command(output_path: &std::path::Path) -> Result<(), AppError> {
    launch_screenclip().map_err(map_capture_spawn_error)?;
    let output = wait_for_clipboard_image(output_path).map_err(map_capture_spawn_error)?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(map_windows_capture_failure(stderr.trim()))
}

#[cfg(any(test, not(any(target_os = "macos", target_os = "windows"))))]
fn run_capture_command(_output_path: &std::path::Path) -> Result<(), AppError> {
    Err(AppError::new(
        ErrorCode::InternalError,
        "Interactive screenshot capture is not implemented on this platform",
        false,
    ))
}

#[cfg(target_os = "windows")]
fn map_capture_spawn_error(error: std::io::Error) -> AppError {
    AppError::new(
        ErrorCode::InternalError,
        format!("Failed to start capture command: {error}"),
        false,
    )
}

#[cfg(target_os = "macos")]
fn map_macos_capture_error(error: Option<HelperError>) -> AppError {
    let code = error
        .as_ref()
        .and_then(|item| item.code.as_deref())
        .unwrap_or("capture_failed");
    let message = error
        .as_ref()
        .and_then(|item| item.message.as_deref())
        .unwrap_or("Screenshot capture failed")
        .to_string();
    let retryable = error
        .as_ref()
        .and_then(|item| item.retryable)
        .unwrap_or(true);

    if code == "user_cancelled" {
        return AppError::new(ErrorCode::UserCancelled, message, false);
    }
    if code == "permission_denied" {
        return AppError::new(ErrorCode::PermissionDenied, message, false);
    }
    if code == "invalid_request" {
        return AppError::new(ErrorCode::ProviderInvalidResponse, message, false);
    }
    AppError::new(ErrorCode::InternalError, message, retryable)
}

#[cfg(target_os = "windows")]
fn map_windows_capture_failure(stderr: &str) -> AppError {
    if stderr.contains("User cancelled screenshot capture") {
        return AppError::new(
            ErrorCode::UserCancelled,
            "User cancelled screenshot capture",
            true,
        );
    }
    if stderr.contains("Access is denied") {
        return AppError::new(
            ErrorCode::PermissionDenied,
            format!("Screenshot permission denied: {stderr}"),
            false,
        );
    }
    AppError::new(
        ErrorCode::InternalError,
        format!("Screenshot capture failed: {stderr}"),
        true,
    )
}
