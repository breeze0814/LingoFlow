use tauri::State;

use crate::app_state::AppState;
use crate::errors::app_error::AppError;
use crate::orchestrator::models::{
    CaptureRect, OcrTranslateTaskOptions, TaskCommandPayload, TaskRequest, TaskResponse,
};
use crate::platform::capture::capture_region_image_file;

#[derive(Debug, Clone, serde::Deserialize)]
pub struct OcrRegionCommandPayload {
    pub capture_rect: CaptureRect,
    pub source_lang: Option<String>,
    pub source_lang_hint: Option<String>,
    pub target_lang: Option<String>,
    pub provider_id: Option<String>,
    pub ocr_provider_id: Option<String>,
    pub translate_provider_configs:
        Option<Vec<crate::apiprovider::runtime_config::TranslateProviderRuntimeConfig>>,
}

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
        source_lang: payload.source_lang,
        source_lang_hint: payload.source_lang_hint,
        target_lang: payload.target_lang,
        provider_id: payload.provider_id,
        ocr_provider_id: payload.ocr_provider_id,
        provider_configs: payload.translate_provider_configs,
    });
    state.orchestrator.execute(request).await
}

#[tauri::command]
pub async fn ocr_recognize_region(
    state: State<'_, AppState>,
    payload: OcrRegionCommandPayload,
) -> Result<TaskResponse, AppError> {
    let request = TaskRequest::ocr_recognize(payload.source_lang_hint, payload.provider_id);
    let (image_path, capture_rect) = capture_region_image_file(&payload.capture_rect)?;
    state
        .orchestrator
        .execute_captured_ocr(
            request,
            image_path.to_string_lossy().into_owned(),
            capture_rect,
        )
        .await
}

#[tauri::command]
pub async fn ocr_translate_region(
    state: State<'_, AppState>,
    payload: OcrRegionCommandPayload,
) -> Result<TaskResponse, AppError> {
    let request = TaskRequest::ocr_translate(OcrTranslateTaskOptions {
        source_lang: payload.source_lang,
        source_lang_hint: payload.source_lang_hint,
        target_lang: payload.target_lang,
        provider_id: payload.provider_id,
        ocr_provider_id: payload.ocr_provider_id,
        provider_configs: payload.translate_provider_configs,
    });
    let (image_path, capture_rect) = capture_region_image_file(&payload.capture_rect)?;
    state
        .orchestrator
        .execute_captured_ocr(
            request,
            image_path.to_string_lossy().into_owned(),
            capture_rect,
        )
        .await
}
