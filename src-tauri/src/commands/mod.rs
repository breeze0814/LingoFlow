pub mod debug;
pub mod ocr;
pub mod runtime_settings;
pub mod shortcuts;
#[cfg(all(not(test), target_os = "windows"))]
pub mod tesseract_ocr;
pub mod translation;
pub mod window_display;
