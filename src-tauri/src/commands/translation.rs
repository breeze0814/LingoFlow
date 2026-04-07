use serde::Serialize;
use tauri::State;

use crate::app_state::AppState;
use crate::errors::app_error::AppError;
use crate::orchestrator::models::{
    TaskCommandPayload, TaskRequest, TaskResponse, TranslateTaskOptions,
};

#[derive(Debug, Serialize)]
pub struct SelectionTextResponse {
    pub selected_text: String,
}

#[tauri::command]
pub async fn selection_translate(
    state: State<'_, AppState>,
    payload: TaskCommandPayload,
) -> Result<TaskResponse, AppError> {
    let mut request = TaskRequest::selection(payload.target_lang, payload.provider_id);
    request.translate_provider_configs = payload.translate_provider_configs;
    state.orchestrator.execute(request).await
}

#[tauri::command]
pub async fn input_translate(
    state: State<'_, AppState>,
    payload: TaskCommandPayload,
) -> Result<TaskResponse, AppError> {
    let request = TaskRequest::input(
        payload.text,
        TranslateTaskOptions {
            source_lang: payload.source_lang,
            target_lang: payload.target_lang,
            provider_id: payload.provider_id,
            provider_configs: payload.translate_provider_configs,
        },
    );
    state.orchestrator.execute(request).await
}

#[tauri::command]
pub fn read_selection_text() -> Result<SelectionTextResponse, AppError> {
    Ok(SelectionTextResponse {
        selected_text: crate::platform::selection::read_selected_text()?,
    })
}
