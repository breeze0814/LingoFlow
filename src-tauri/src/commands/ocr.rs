use tauri::State;

use crate::app_state::AppState;
use crate::errors::app_error::AppError;
use crate::orchestrator::models::{
    OcrTranslateTaskOptions, TaskCommandPayload, TaskRequest, TaskResponse,
};

#[tauri::command]
pub async fn ocr_recognize(
    state: State<'_, AppState>,
    payload: TaskCommandPayload,
) -> Result<TaskResponse, AppError> {
    let request = TaskRequest::ocr_recognize(payload.source_lang_hint, payload.provider_id);
    state.orchestrator.execute(request).await
}

#[tauri::command]
pub async fn ocr_translate(
    state: State<'_, AppState>,
    payload: TaskCommandPayload,
) -> Result<TaskResponse, AppError> {
    let request = TaskRequest::ocr_translate(OcrTranslateTaskOptions {
        source_lang_hint: payload.source_lang_hint,
        target_lang: payload.target_lang,
        provider_id: payload.provider_id,
        ocr_provider_id: payload.ocr_provider_id,
    });
    state.orchestrator.execute(request).await
}
