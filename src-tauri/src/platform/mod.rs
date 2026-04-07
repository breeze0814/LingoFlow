pub mod capture;
#[cfg(target_os = "macos")]
pub mod macos_helper;
pub mod selection;
#[cfg(all(target_os = "windows", not(test)))]
pub mod windows_capture;
#[cfg(all(target_os = "windows", not(test)))]
pub mod windows_window;
