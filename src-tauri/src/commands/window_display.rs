#[tauri::command]
pub async fn set_capture_excluded(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let raw_hwnd = window
            .hwnd()
            .map_err(|e| format!("Failed to get HWND: {e}"))?;
        crate::platform::windows_window::exclude_window_from_capture(raw_hwnd.0 as isize)?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = &window;
    }
    Ok(())
}
