use std::path::PathBuf;
use std::process::Command;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::orchestrator::models::CaptureRect;

const WINDOWS_CAPTURE_TIMEOUT_SECONDS: u64 = 120;

pub fn capture_interactive_image() -> Result<(PathBuf, Option<CaptureRect>), AppError> {
    let output_path = build_capture_output_path();
    run_capture_command(&output_path)?;
    let path = ensure_capture_file_exists(output_path)?;
    Ok((path, None))
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
fn run_capture_command(output_path: &PathBuf) -> Result<(), AppError> {
    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-STA")
        .arg("-Command")
        .arg(build_windows_capture_script(output_path))
        .output()
        .map_err(map_capture_spawn_error)?;
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

#[cfg(target_os = "windows")]
fn build_windows_capture_script(output_path: &PathBuf) -> String {
    let escaped_path = output_path.to_string_lossy().replace('\'', "''");
    format!(
        concat!(
            "Add-Type -AssemblyName System.Windows.Forms; ",
            "Add-Type -AssemblyName System.Drawing; ",
            "Add-Type @'\n",
            "using System.Runtime.InteropServices;\n",
            "public static class ClipboardSequence {{\n",
            "  [DllImport(\"user32.dll\")] public static extern uint GetClipboardSequenceNumber();\n",
            "}}\n",
            "'@; ",
            "$outputPath = '{}'; ",
            "$initialSequence = [ClipboardSequence]::GetClipboardSequenceNumber(); ",
            "Start-Process 'explorer.exe' 'ms-screenclip:'; ",
            "$deadline = (Get-Date).AddSeconds({}); ",
            "while ((Get-Date) -lt $deadline) {{ ",
            "  Start-Sleep -Milliseconds 200; ",
            "  $nextSequence = [ClipboardSequence]::GetClipboardSequenceNumber(); ",
            "  if ($nextSequence -eq $initialSequence) {{ continue; }} ",
            "  if (-not [System.Windows.Forms.Clipboard]::ContainsImage()) {{ continue; }} ",
            "  $image = [System.Windows.Forms.Clipboard]::GetImage(); ",
            "  if ($null -eq $image) {{ continue; }} ",
            "  $image.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png); ",
            "  exit 0; ",
            "}} ",
            "Write-Error 'User cancelled screenshot capture'; ",
            "exit 1"
        ),
        escaped_path,
        WINDOWS_CAPTURE_TIMEOUT_SECONDS
    )
}
