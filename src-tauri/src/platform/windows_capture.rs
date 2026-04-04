#[cfg(target_os = "windows")]
use std::path::Path;
#[cfg(target_os = "windows")]
use std::process::{Command, Output};

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::orchestrator::models::CaptureRect;

pub const WINDOWS_CAPTURE_TIMEOUT_SECONDS: u64 = 120;

#[cfg(target_os = "windows")]
const WINDOWS_CAPTURE_LAUNCHER: &str = "explorer.exe";
#[cfg(target_os = "windows")]
const WINDOWS_SCREENCLIP_URI: &str = "ms-screenclip:";

#[cfg(target_os = "windows")]
pub fn launch_screenclip() -> std::io::Result<()> {
    let _child = Command::new(WINDOWS_CAPTURE_LAUNCHER)
        .arg(WINDOWS_SCREENCLIP_URI)
        .spawn()?;
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn wait_for_clipboard_image(output_path: &Path) -> std::io::Result<Output> {
    Command::new("powershell")
        .arg("-NoProfile")
        .arg("-STA")
        .arg("-Command")
        .arg(build_clipboard_wait_script(
            &output_path.to_string_lossy(),
            WINDOWS_CAPTURE_TIMEOUT_SECONDS,
        ))
        .output()
}

pub fn build_clipboard_wait_script(output_path: &str, timeout_seconds: u64) -> String {
    let escaped_path = output_path.replace('\'', "''");
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
        timeout_seconds
    )
}

#[cfg(target_os = "windows")]
pub fn capture_region_image(output_path: &Path, capture_rect: &CaptureRect) -> Result<(), AppError> {
    let rect = normalize_capture_rect(capture_rect)?;
    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-STA")
        .arg("-Command")
        .arg(build_region_capture_script(
            &output_path.to_string_lossy(),
            rect.x,
            rect.y,
            rect.width,
            rect.height,
        ))
        .output()
        .map_err(map_region_capture_spawn_error)?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(AppError::new(
        ErrorCode::InternalError,
        format!("Region capture failed: {}", stderr.trim()),
        true,
    ))
}

#[cfg(target_os = "windows")]
fn normalize_capture_rect(capture_rect: &CaptureRect) -> Result<PixelCaptureRect, AppError> {
    let x = capture_rect.x.round() as i32;
    let y = capture_rect.y.round() as i32;
    let width = capture_rect.width.round() as i32;
    let height = capture_rect.height.round() as i32;

    if width <= 0 || height <= 0 {
        return Err(AppError::new(
            ErrorCode::NoSelection,
            "Capture region is empty",
            false,
        ));
    }

    Ok(PixelCaptureRect {
        x,
        y,
        width,
        height,
    })
}

#[cfg(target_os = "windows")]
fn map_region_capture_spawn_error(error: std::io::Error) -> AppError {
    AppError::new(
        ErrorCode::InternalError,
        format!("Failed to start region capture command: {error}"),
        false,
    )
}

pub fn build_region_capture_script(
    output_path: &str,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> String {
    let escaped_path = output_path.replace('\'', "''");
    format!(
        concat!(
            "Add-Type -AssemblyName System.Drawing; ",
            "$bitmap = New-Object System.Drawing.Bitmap({}, {}); ",
            "$graphics = [System.Drawing.Graphics]::FromImage($bitmap); ",
            "$graphics.CopyFromScreen({}, {}, 0, 0, $bitmap.Size, [System.Drawing.CopyPixelOperation]::SourceCopy); ",
            "$bitmap.Save('{}', [System.Drawing.Imaging.ImageFormat]::Png); ",
            "$graphics.Dispose(); ",
            "$bitmap.Dispose(); ",
            "exit 0"
        ),
        width,
        height,
        x,
        y,
        escaped_path
    )
}

#[cfg(target_os = "windows")]
struct PixelCaptureRect {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
}
