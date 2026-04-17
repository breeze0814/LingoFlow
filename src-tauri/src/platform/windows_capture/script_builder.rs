use std::path::Path;
use std::process::{Command, Output};

pub const WINDOWS_CAPTURE_TIMEOUT_SECONDS: u64 = 120;

const WINDOWS_CAPTURE_LAUNCHER: &str = "explorer.exe";
const WINDOWS_SCREENCLIP_URI: &str = "ms-screenclip:";

pub fn launch_screenclip() -> std::io::Result<()> {
    let _child = Command::new(WINDOWS_CAPTURE_LAUNCHER)
        .arg(WINDOWS_SCREENCLIP_URI)
        .spawn()?;
    Ok(())
}

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

/// Parameters for region capture script
pub struct RegionCaptureParams<'a> {
    pub output_path: &'a str,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

pub fn build_region_capture_script(params: RegionCaptureParams<'_>) -> String {
    let escaped_path = params.output_path.replace('\'', "''");
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
        params.width,
        params.height,
        params.x,
        params.y,
        escaped_path
    )
}
