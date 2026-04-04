use std::path::PathBuf;
#[cfg(target_os = "macos")]
use std::process::Command;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::orchestrator::models::CaptureRect;
#[cfg(target_os = "windows")]
use crate::platform::windows_capture::{
    capture_region_image, launch_screenclip, wait_for_clipboard_image,
};

pub fn capture_interactive_image() -> Result<(PathBuf, Option<CaptureRect>), AppError> {
    let output_path = build_capture_output_path();
    run_capture_command(&output_path)?;
    let path = ensure_capture_file_exists(output_path)?;
    Ok((path, None))
}

pub fn capture_region_image_file(capture_rect: &CaptureRect) -> Result<(PathBuf, CaptureRect), AppError> {
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
    let output = Command::new("screencapture")
        .arg("-i")
        .arg("-x")
        .arg(output_path)
        .output()
        .map_err(map_capture_spawn_error)?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(map_macos_capture_failure(output.status.code(), stderr.trim()))
}

#[cfg(target_os = "windows")]
fn run_region_capture_command(output_path: &PathBuf, capture_rect: &CaptureRect) -> Result<(), AppError> {
    capture_region_image(output_path, capture_rect)
}

#[cfg(not(target_os = "windows"))]
fn run_region_capture_command(_output_path: &PathBuf, _capture_rect: &CaptureRect) -> Result<(), AppError> {
    Err(AppError::new(
        ErrorCode::InternalError,
        "Direct region capture is only implemented on Windows",
        false,
    ))
}

#[cfg(target_os = "windows")]
fn run_capture_command(output_path: &PathBuf) -> Result<(), AppError> {
    launch_screenclip().map_err(map_capture_spawn_error)?;
    let output = wait_for_clipboard_image(output_path).map_err(map_capture_spawn_error)?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(map_windows_capture_failure(stderr.trim()))
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn run_capture_command(_output_path: &PathBuf) -> Result<(), AppError> {
    Err(AppError::new(
        ErrorCode::InternalError,
        "Interactive screenshot capture is not implemented on this platform",
        false,
    ))
}

fn map_capture_spawn_error(error: std::io::Error) -> AppError {
    AppError::new(
        ErrorCode::InternalError,
        format!("Failed to start capture command: {error}"),
        false,
    )
}

#[cfg(target_os = "macos")]
fn map_macos_capture_failure(code: Option<i32>, stderr: &str) -> AppError {
    if code == Some(1) {
        return AppError::new(
            ErrorCode::UserCancelled,
            "User cancelled screenshot capture",
            true,
        );
    }

    if stderr.contains("Operation not permitted")
        || stderr.contains("not authorized")
        || stderr.contains("permission")
    {
        return AppError::new(
            ErrorCode::PermissionDenied,
            format!("Screenshot permission denied: {stderr}"),
            false,
        );
    }

    AppError::new(
        ErrorCode::InternalError,
        format!("Screenshot capture failed (code={code:?}): {stderr}"),
        true,
    )
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
