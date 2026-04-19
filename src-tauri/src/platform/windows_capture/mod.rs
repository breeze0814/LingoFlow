#[cfg(target_os = "windows")]
mod native_capture;
#[cfg(target_os = "windows")]
mod png_encoding;
#[cfg(target_os = "windows")]
mod script_builder;

// These exports are only used in non-test Windows builds (see platform/capture.rs)
#[cfg(all(target_os = "windows", not(test)))]
pub use native_capture::capture_region_image;
#[cfg(all(target_os = "windows", not(test)))]
pub use script_builder::{launch_screenclip, wait_for_clipboard_image};

// These are used in tests and other contexts
#[cfg(target_os = "windows")]
pub use script_builder::{build_clipboard_wait_script, build_region_capture_script, RegionCaptureParams};
