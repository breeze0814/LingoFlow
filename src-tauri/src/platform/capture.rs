use std::path::PathBuf;
use std::process::Command;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;

const CAPTURE_COMMAND: &str = "screencapture";

pub fn capture_interactive_image() -> Result<PathBuf, AppError> {
    let output_path = build_capture_output_path();
    let output = Command::new(CAPTURE_COMMAND)
        .arg("-i")
        .arg("-x")
        .arg(&output_path)
        .output()
        .map_err(map_capture_spawn_error)?;

    if output.status.success() {
        return ensure_capture_file_exists(output_path);
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(map_capture_failure(output.status.code(), stderr.trim()))
}

fn build_capture_output_path() -> PathBuf {
    let file_name = format!("mydict-capture-{}.png", uuid::Uuid::new_v4());
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

fn map_capture_spawn_error(error: std::io::Error) -> AppError {
    AppError::new(
        ErrorCode::InternalError,
        format!("Failed to start screencapture command: {error}"),
        false,
    )
}

fn map_capture_failure(code: Option<i32>, stderr: &str) -> AppError {
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
