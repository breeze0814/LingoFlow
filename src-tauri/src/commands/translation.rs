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
    let runtime_settings = state.http_api_state.runtime_provider_settings()?;
    let mut request = TaskRequest::selection(
        payload.target_lang,
        payload
            .provider_id
            .or_else(|| runtime_settings.default_translate_provider.clone()),
    );
    request.translate_provider_configs = runtime_settings.translate_provider_configs_option();
    state.orchestrator.execute(request).await
}

#[tauri::command]
pub async fn input_translate(
    state: State<'_, AppState>,
    payload: TaskCommandPayload,
) -> Result<TaskResponse, AppError> {
    let runtime_settings = state.http_api_state.runtime_provider_settings()?;
    let request = TaskRequest::input(
        payload.text,
        TranslateTaskOptions {
            source_lang: payload.source_lang,
            target_lang: payload.target_lang,
            provider_id: payload
                .provider_id
                .or_else(|| runtime_settings.default_translate_provider.clone()),
            provider_configs: runtime_settings.translate_provider_configs_option(),
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
