use crate::errors::app_error::AppError;
use crate::platform::permissions::PermissionStatus;

#[tauri::command]
pub fn get_permission_status() -> Result<PermissionStatus, AppError> {
    crate::platform::permissions::read_permission_status()
}
