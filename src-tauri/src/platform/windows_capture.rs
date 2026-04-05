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
    native_capture_region(output_path, &rect)
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
pub struct PixelCaptureRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[cfg(target_os = "windows")]
use std::io::Write as IoWrite;

#[cfg(target_os = "windows")]
pub fn native_capture_region(
    output_path: &Path,
    rect: &PixelCaptureRect,
) -> Result<(), AppError> {
    use windows::Win32::Foundation::*;
    use windows::Win32::Graphics::Gdi::*;

    if rect.width <= 0 || rect.height <= 0 {
        return Err(AppError::new(
            ErrorCode::NoSelection,
            "Capture region is empty",
            false,
        ));
    }

    unsafe {
        let hdc_screen = GetDC(None);
        if hdc_screen.is_invalid() {
            return Err(AppError::new(
                ErrorCode::InternalError,
                "Failed to get screen device context",
                false,
            ));
        }

        let hdc_mem = CreateCompatibleDC(hdc_screen);
        if hdc_mem.is_invalid() {
            ReleaseDC(None, hdc_screen);
            return Err(AppError::new(
                ErrorCode::InternalError,
                "Failed to create compatible device context",
                false,
            ));
        }

        let hbm = CreateCompatibleBitmap(hdc_screen, rect.width, rect.height);
        if hbm.is_invalid() {
            let _ = DeleteDC(hdc_mem);
            ReleaseDC(None, hdc_screen);
            return Err(AppError::new(
                ErrorCode::InternalError,
                "Failed to create compatible bitmap",
                false,
            ));
        }

        let old_bm = SelectObject(hdc_mem, hbm);
        let blt_ok = BitBlt(
            hdc_mem,
            0,
            0,
            rect.width,
            rect.height,
            hdc_screen,
            rect.x,
            rect.y,
            SRCCOPY,
        );

        if blt_ok.is_err() {
            SelectObject(hdc_mem, old_bm);
            let _ = DeleteObject(hbm);
            let _ = DeleteDC(hdc_mem);
            ReleaseDC(None, hdc_screen);
            return Err(AppError::new(
                ErrorCode::InternalError,
                "BitBlt screen capture failed",
                false,
            ));
        }

        // Read bitmap pixel data
        let bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: rect.width,
                biHeight: -rect.height, // top-down DIB
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD::default()],
        };

        let row_bytes = (rect.width as usize) * 4;
        let mut pixels = vec![0u8; row_bytes * rect.height as usize];

        GetDIBits(
            hdc_mem,
            hbm,
            0,
            rect.height as u32,
            Some(pixels.as_mut_ptr().cast()),
            &bmi as *const _ as *mut _,
            DIB_RGB_COLORS,
        );

        // Cleanup GDI resources
        SelectObject(hdc_mem, old_bm);
        let _ = DeleteObject(hbm);
        let _ = DeleteDC(hdc_mem);
        ReleaseDC(None, hdc_screen);

        // Convert BGRA → RGBA
        for chunk in pixels.chunks_exact_mut(4) {
            chunk.swap(0, 2);
        }

        // Encode minimal PNG
        write_rgba_png(
            output_path,
            rect.width as u32,
            rect.height as u32,
            &pixels,
        )
    }
}

#[cfg(target_os = "windows")]
fn write_rgba_png(
    output_path: &Path,
    width: u32,
    height: u32,
    rgba_pixels: &[u8],
) -> Result<(), AppError> {
    // Build raw image data with filter byte per row
    let row_len = (width as usize) * 4;
    let mut raw_data =
        Vec::with_capacity((row_len + 1) * height as usize);
    for row in rgba_pixels.chunks_exact(row_len) {
        raw_data.push(0u8); // filter: None
        raw_data.extend_from_slice(row);
    }

    let compressed = deflate_zlib(&raw_data);

    let mut file = std::fs::File::create(output_path).map_err(|e| {
        AppError::new(
            ErrorCode::InternalError,
            format!("Failed to create capture file: {e}"),
            false,
        )
    })?;

    // PNG signature
    file.write_all(&[137, 80, 78, 71, 13, 10, 26, 10])
        .map_err(map_png_write_error)?;

    // IHDR chunk
    let mut ihdr = Vec::with_capacity(13);
    ihdr.extend_from_slice(&width.to_be_bytes());
    ihdr.extend_from_slice(&height.to_be_bytes());
    ihdr.push(8); // bit depth
    ihdr.push(6); // color type: RGBA
    ihdr.push(0); // compression
    ihdr.push(0); // filter
    ihdr.push(0); // interlace
    write_png_chunk(&mut file, b"IHDR", &ihdr)?;

    // IDAT chunk
    write_png_chunk(&mut file, b"IDAT", &compressed)?;

    // IEND chunk
    write_png_chunk(&mut file, b"IEND", &[])?;

    Ok(())
}

#[cfg(target_os = "windows")]
fn write_png_chunk(
    file: &mut std::fs::File,
    chunk_type: &[u8; 4],
    data: &[u8],
) -> Result<(), AppError> {
    let len = data.len() as u32;
    file.write_all(&len.to_be_bytes())
        .map_err(map_png_write_error)?;
    file.write_all(chunk_type)
        .map_err(map_png_write_error)?;
    file.write_all(data).map_err(map_png_write_error)?;

    let mut crc_input = Vec::with_capacity(4 + data.len());
    crc_input.extend_from_slice(chunk_type);
    crc_input.extend_from_slice(data);
    let crc = png_crc32(&crc_input);
    file.write_all(&crc.to_be_bytes())
        .map_err(map_png_write_error)?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn map_png_write_error(e: std::io::Error) -> AppError {
    AppError::new(
        ErrorCode::InternalError,
        format!("Failed to write PNG: {e}"),
        false,
    )
}

#[cfg(target_os = "windows")]
fn png_crc32(data: &[u8]) -> u32 {
    let mut crc: u32 = 0xFFFFFFFF;
    for &byte in data {
        crc ^= byte as u32;
        for _ in 0..8 {
            if crc & 1 != 0 {
                crc = (crc >> 1) ^ 0xEDB88320;
            } else {
                crc >>= 1;
            }
        }
    }
    crc ^ 0xFFFFFFFF
}

#[cfg(target_os = "windows")]
fn deflate_zlib(data: &[u8]) -> Vec<u8> {
    let mut output = Vec::new();

    // zlib header: CM=8, CINFO=7, FCHECK so header % 31 == 0
    output.push(0x78);
    output.push(0x01); // no compression level

    // Split data into DEFLATE stored blocks (max 65535 bytes each)
    let chunks: Vec<&[u8]> = data.chunks(65535).collect();
    for (i, chunk) in chunks.iter().enumerate() {
        let is_last = i == chunks.len() - 1;
        output.push(if is_last { 0x01 } else { 0x00 });
        let len = chunk.len() as u16;
        let nlen = !len;
        output.extend_from_slice(&len.to_le_bytes());
        output.extend_from_slice(&nlen.to_le_bytes());
        output.extend_from_slice(chunk);
    }

    // Adler-32 checksum
    let adler = adler32(data);
    output.extend_from_slice(&adler.to_be_bytes());

    output
}

#[cfg(target_os = "windows")]
fn adler32(data: &[u8]) -> u32 {
    let mut a: u32 = 1;
    let mut b: u32 = 0;
    for &byte in data {
        a = (a + byte as u32) % 65521;
        b = (b + a) % 65521;
    }
    (b << 16) | a
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_region_capture_produces_valid_png() {
        let output_path =
            std::env::temp_dir().join("test-native-capture.png");
        let rect = PixelCaptureRect {
            x: 0,
            y: 0,
            width: 100,
            height: 100,
        };
        native_capture_region(&output_path, &rect)
            .expect("native capture should succeed");
        assert!(output_path.exists(), "output file should be created");
        let metadata = std::fs::metadata(&output_path)
            .expect("should read metadata");
        assert!(
            metadata.len() > 0,
            "output file should not be empty"
        );
        // Check PNG magic bytes
        let bytes =
            std::fs::read(&output_path).expect("should read file");
        assert_eq!(
            &bytes[..4],
            &[0x89, 0x50, 0x4E, 0x47],
            "should be a valid PNG"
        );
        let _ = std::fs::remove_file(&output_path);
    }

    #[test]
    fn native_region_capture_rejects_zero_dimensions() {
        let output_path =
            std::env::temp_dir().join("test-native-capture-zero.png");
        let rect = PixelCaptureRect {
            x: 0,
            y: 0,
            width: 0,
            height: 100,
        };
        let result = native_capture_region(&output_path, &rect);
        assert!(
            result.is_err(),
            "zero-width capture should fail"
        );
        let _ = std::fs::remove_file(&output_path);
    }
}
