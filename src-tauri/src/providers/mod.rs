#[cfg(target_os = "macos")]
pub mod apple_vision_ocr;
pub mod base64;
pub mod openai_compatible_ocr;
pub mod registry;
pub mod runtime_translate_factory;
#[cfg(all(target_os = "windows", not(test)))]
pub mod tesseract_js_bridge;
#[cfg(all(target_os = "windows", not(test)))]
pub mod tesseract_js_ocr;
pub mod traits;
