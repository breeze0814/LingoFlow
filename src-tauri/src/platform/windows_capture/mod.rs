#[cfg(target_os = "windows")]
mod native_capture;
#[cfg(target_os = "windows")]
mod png_encoding;
#[cfg(target_os = "windows")]
mod script_builder;

#[cfg(target_os = "windows")]
pub use native_capture::capture_region_image;
#[cfg(target_os = "windows")]
pub use script_builder::{
    build_clipboard_wait_script, build_region_capture_script, launch_screenclip,
    wait_for_clipboard_image,
};
