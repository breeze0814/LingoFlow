#[cfg(target_os = "windows")]
use windows::Win32::Foundation::HWND;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity, WINDOW_DISPLAY_AFFINITY};

/// WDA_EXCLUDEFROMCAPTURE = 0x00000011 (available since Windows 10 version 2004)
#[cfg(target_os = "windows")]
const WDA_EXCLUDEFROMCAPTURE: WINDOW_DISPLAY_AFFINITY = WINDOW_DISPLAY_AFFINITY(0x00000011);

#[cfg(target_os = "windows")]
pub fn exclude_window_from_capture(hwnd_raw: isize) -> Result<(), String> {
    unsafe {
        let hwnd = HWND(hwnd_raw as *mut _);
        SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)
            .map_err(|e| format!("SetWindowDisplayAffinity failed: {e}"))
    }
}
