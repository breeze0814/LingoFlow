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
    pub ocr_provider_configs:
        Option<Vec<crate::apiprovider::runtime_config::OcrProviderRuntimeConfig>>,
    pub translate_provider_configs:
        Option<Vec<crate::apiprovider::runtime_config::TranslateProviderRuntimeConfig>>,
}

#[tauri::command]
pub async fn ocr_recognize(
    state: State<'_, AppState>,
    payload: TaskCommandPayload,
) -> Result<TaskResponse, AppError> {
    let runtime_settings = state.http_api_state.runtime_provider_settings()?;
    let request = TaskRequest::ocr_recognize_with_configs(
        payload.source_lang_hint,
        payload
            .ocr_provider_id
            .or(payload.provider_id)
            .or_else(|| runtime_settings.default_runtime_ocr_provider_id()),
        runtime_settings.ocr_provider_configs_option(),
    );
    state.orchestrator.execute(request).await
}

#[tauri::command]
pub async fn ocr_translate(
    state: State<'_, AppState>,
    payload: TaskCommandPayload,
) -> Result<TaskResponse, AppError> {
    let runtime_settings = state.http_api_state.runtime_provider_settings()?;
    let request = TaskRequest::ocr_translate(OcrTranslateTaskOptions {
        source_lang: payload.source_lang,
        source_lang_hint: payload.source_lang_hint,
        target_lang: payload.target_lang,
        provider_id: payload
            .provider_id
            .or_else(|| runtime_settings.default_translate_provider.clone()),
        ocr_provider_id: payload
            .ocr_provider_id
            .or_else(|| runtime_settings.default_runtime_ocr_provider_id()),
        ocr_provider_configs: runtime_settings.ocr_provider_configs_option(),
        provider_configs: runtime_settings.translate_provider_configs_option(),
    });
    state.orchestrator.execute(request).await
}

#[tauri::command]
pub async fn ocr_recognize_region(
    state: State<'_, AppState>,
    payload: OcrRegionCommandPayload,
) -> Result<TaskResponse, AppError> {
    let runtime_settings = state.http_api_state.runtime_provider_settings()?;
    let request = TaskRequest::ocr_recognize_with_configs(
        payload.source_lang_hint,
        payload
            .ocr_provider_id
            .or(payload.provider_id)
            .or_else(|| runtime_settings.default_runtime_ocr_provider_id()),
        runtime_settings.ocr_provider_configs_option(),
    );
    let (image_path, capture_rect) =
        capture_region_image_file_blocking(payload.capture_rect.clone()).await?;
    state
        .orchestrator
        .execute_captured_ocr(crate::orchestrator::ocr_execution::CapturedOcrInput {
            request,
            image_path: image_path.to_string_lossy().into_owned(),
            capture_rect,
        })
        .await
}

#[tauri::command]
pub async fn ocr_translate_region(
    state: State<'_, AppState>,
    payload: OcrRegionCommandPayload,
) -> Result<TaskResponse, AppError> {
    let runtime_settings = state.http_api_state.runtime_provider_settings()?;
    let request = TaskRequest::ocr_translate(OcrTranslateTaskOptions {
        source_lang: payload.source_lang,
        source_lang_hint: payload.source_lang_hint,
        target_lang: payload.target_lang,
        provider_id: payload
            .provider_id
            .or_else(|| runtime_settings.default_translate_provider.clone()),
        ocr_provider_id: payload
            .ocr_provider_id
            .or_else(|| runtime_settings.default_runtime_ocr_provider_id()),
        ocr_provider_configs: runtime_settings.ocr_provider_configs_option(),
        provider_configs: runtime_settings.translate_provider_configs_option(),
    });
    let (image_path, capture_rect) =
        capture_region_image_file_blocking(payload.capture_rect.clone()).await?;
    state
        .orchestrator
        .execute_captured_ocr(crate::orchestrator::ocr_execution::CapturedOcrInput {
            request,
            image_path: image_path.to_string_lossy().into_owned(),
            capture_rect,
        })
        .await
}

async fn capture_region_image_file_blocking(
    capture_rect: CaptureRect,
) -> Result<(std::path::PathBuf, CaptureRect), AppError> {
    tauri::async_runtime::spawn_blocking(move || capture_region_image_file(&capture_rect))
        .await
        .map_err(|error| {
            AppError::new(
                crate::errors::error_code::ErrorCode::InternalError,
                format!("Region capture task failed to join: {error}"),
                true,
            )
        })?
}
