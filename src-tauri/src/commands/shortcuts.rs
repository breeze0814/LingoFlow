use crate::shortcuts::{sync_shortcuts, ShortcutConfig};

#[tauri::command]
pub fn sync_global_shortcuts(
    app: tauri::AppHandle,
    shortcuts: ShortcutConfig,
) -> Result<(), String> {
    sync_shortcuts(&app, shortcuts)
}
