use std::path::Path;

use windows::Win32::Graphics::Gdi::{
    BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits,
    ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, RGBQUAD,
    SRCCOPY,
};

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
#[cfg_attr(test, allow(unused_imports))]
use crate::orchestrator::models::CaptureRect;

use super::png_encoding::{write_rgba_png, PngEncodeParams};

pub struct PixelCaptureRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

// Used in non-test Windows builds via platform/capture.rs
#[cfg(not(test))]
pub fn capture_region_image(
    output_path: &Path,
    capture_rect: &CaptureRect,
) -> Result<(), AppError> {
    let rect = normalize_capture_rect(capture_rect)?;
    native_capture_region(output_path, &rect)
}

pub fn native_capture_region(output_path: &Path, rect: &PixelCaptureRect) -> Result<(), AppError> {
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

        let bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: rect.width,
                biHeight: -rect.height,
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

        SelectObject(hdc_mem, old_bm);
        let _ = DeleteObject(hbm);
        let _ = DeleteDC(hdc_mem);
        ReleaseDC(None, hdc_screen);

        for chunk in pixels.chunks_exact_mut(4) {
            chunk.swap(0, 2);
        }

        write_rgba_png(PngEncodeParams {
            output_path,
            width: rect.width as u32,
            height: rect.height as u32,
            rgba_pixels: &pixels,
        })
    }
}

#[cfg(not(test))]
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

#[cfg(test)]
mod tests {
    use super::{native_capture_region, PixelCaptureRect};

    #[test]
    fn native_region_capture_produces_valid_png() {
        let output_path = std::env::temp_dir().join("test-native-capture.png");
        let rect = PixelCaptureRect {
            x: 0,
            y: 0,
            width: 100,
            height: 100,
        };
        native_capture_region(&output_path, &rect).expect("native capture should succeed");
        assert!(output_path.exists(), "output file should be created");
        let metadata = std::fs::metadata(&output_path).expect("should read metadata");
        assert!(metadata.len() > 0, "output file should not be empty");
        let bytes = std::fs::read(&output_path).expect("should read file");
        assert_eq!(
            &bytes[..4],
            &[0x89, 0x50, 0x4E, 0x47],
            "should be a valid PNG"
        );
        let _ = std::fs::remove_file(&output_path);
    }

    #[test]
    fn native_region_capture_rejects_zero_dimensions() {
        let output_path = std::env::temp_dir().join("test-native-capture-zero.png");
        let rect = PixelCaptureRect {
            x: 0,
            y: 0,
            width: 0,
            height: 100,
        };
        let result = native_capture_region(&output_path, &rect);
        assert!(result.is_err(), "zero-width capture should fail");
        let _ = std::fs::remove_file(&output_path);
    }
}
