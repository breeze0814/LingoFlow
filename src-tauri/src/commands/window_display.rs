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

#[derive(serde::Serialize)]
struct MonitorPoint {
    x: i32,
    y: i32,
}

#[derive(serde::Serialize)]
struct MonitorDimension {
    width: u32,
    height: u32,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CursorMonitorInfo {
    position: MonitorPoint,
    size: MonitorDimension,
    scale_factor: f64,
}

fn monitor_to_info(monitor: &tauri::Monitor) -> CursorMonitorInfo {
    let pos = monitor.position();
    let size = monitor.size();
    CursorMonitorInfo {
        position: MonitorPoint {
            x: pos.x,
            y: pos.y,
        },
        size: MonitorDimension {
            width: size.width,
            height: size.height,
        },
        scale_factor: monitor.scale_factor(),
    }
}

#[tauri::command]
pub async fn resolve_cursor_monitor(
    window: tauri::WebviewWindow,
) -> Result<CursorMonitorInfo, String> {
    let cursor = window
        .cursor_position()
        .map_err(|e| format!("Failed to get cursor position: {e}"))?;
    let monitors = window
        .available_monitors()
        .map_err(|e| format!("Failed to get monitors: {e}"))?;

    for monitor in &monitors {
        let pos = monitor.position();
        let size = monitor.size();
        if cursor.x >= pos.x as f64
            && cursor.x < (pos.x + size.width as i32) as f64
            && cursor.y >= pos.y as f64
            && cursor.y < (pos.y + size.height as i32) as f64
        {
            return Ok(monitor_to_info(monitor));
        }
    }

    let current = window
        .current_monitor()
        .map_err(|e| format!("Failed to get current monitor: {e}"))?;
    if let Some(ref monitor) = current {
        return Ok(monitor_to_info(monitor));
    }

    Err("无法获取当前屏幕信息".to_string())
}
