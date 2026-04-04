use tauri::State;

use crate::app_state::AppState;
use crate::errors::app_error::AppError;
use crate::providers::tesseract_js_bridge::TesseractOcrResponsePayload;

#[tauri::command]
pub async fn resolve_tesseract_ocr(
    state: State<'_, AppState>,
    payload: TesseractOcrResponsePayload,
) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    state.providers.tesseract_js_bridge().resolve(payload).await;

    #[cfg(not(target_os = "windows"))]
    let _ = (state, payload);

    Ok(())
}
