pub mod capture;
#[cfg(target_os = "macos")]
pub mod macos_helper;
pub mod selection;
#[cfg(target_os = "windows")]
pub mod windows_capture;
#[cfg(target_os = "windows")]
pub mod windows_window;
