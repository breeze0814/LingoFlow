use std::sync::Arc;

use axum::extract::{Json, Query, State};
use axum::routing::{get, post};
use axum::Router;
use serde::Deserialize;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::http_api::state::HttpApiState;
use crate::http_api::ui_dispatcher::OpenInputTranslateRequest;
use crate::orchestrator::models::{
    OcrTranslateTaskOptions, TaskCommandPayload, TaskRequest, TaskResponse, TranslateTaskOptions,
};

const MAX_TRANSLATE_TEXT_CHARS: usize = 20_000;

#[derive(Debug, Deserialize)]
pub struct TranslateBody {
    text: String,
    source_lang: Option<String>,
    target_lang: Option<String>,
    provider_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CommonQuery {
    source_lang: Option<String>,
    target_lang: Option<String>,
    provider_id: Option<String>,
    source_lang_hint: Option<String>,
    ocr_provider_id: Option<String>,
    text: Option<String>,
}

pub fn build_router(state: Arc<HttpApiState>) -> Router {
    Router::new()
        .route("/translate", post(post_translate))
        .route("/selection_translate", get(get_selection_translate))
        .route("/input_translate", get(get_input_translate))
        .route("/ocr_recognize", get(get_ocr_recognize))
        .route("/ocr_translate", get(get_ocr_translate))
        .with_state(state)
}

async fn post_translate(
    State(state): State<Arc<HttpApiState>>,
    Json(body): Json<TranslateBody>,
) -> Result<Json<TaskResponse>, AppError> {
    let runtime_settings = state.runtime_provider_settings()?;
    validate_translate_text(&body.text)?;
    let payload = TaskCommandPayload {
        text: Some(body.text),
        source_lang: body.source_lang,
        source_lang_hint: None,
        target_lang: body.target_lang,
        provider_id: body
            .provider_id
            .or_else(|| runtime_settings.default_translate_provider.clone()),
        ocr_provider_id: None,
        ocr_provider_configs: None,
        translate_provider_configs: None,
    };
    let request = TaskRequest::input(
        payload.text,
        TranslateTaskOptions {
            source_lang: payload.source_lang,
            target_lang: payload.target_lang,
            provider_id: payload.provider_id,
            provider_configs: runtime_settings.translate_provider_configs_option(),
        },
    );
    let response = state.orchestrator.execute(request).await?;
    Ok(Json(response))
}

async fn get_selection_translate(
    State(state): State<Arc<HttpApiState>>,
    Query(query): Query<CommonQuery>,
) -> Result<Json<TaskResponse>, AppError> {
    let runtime_settings = state.runtime_provider_settings()?;
    let mut request = TaskRequest::selection(
        query.target_lang,
        query
            .provider_id
            .or_else(|| runtime_settings.default_translate_provider.clone()),
    );
    request.translate_provider_configs = runtime_settings.translate_provider_configs_option();
    let response = state.orchestrator.execute(request).await?;
    Ok(Json(response))
}

async fn get_input_translate(
    State(state): State<Arc<HttpApiState>>,
    Query(query): Query<CommonQuery>,
) -> Result<Json<TaskResponse>, AppError> {
    if let Some(text) = query.text.as_deref() {
        validate_translate_text(text)?;
    }
    state
        .ui_dispatcher
        .open_input_translate(OpenInputTranslateRequest {
            text: query.text.clone(),
            source_lang: query.source_lang.clone(),
            target_lang: query.target_lang.clone(),
        })?;
    let task = TaskResponse {
        ok: true,
        task_id: "open_input_panel".to_string(),
        status: crate::orchestrator::models::TaskStatus::Accepted,
        data: query
            .text
            .map(|text| crate::orchestrator::models::TaskData {
                provider_id: "ui".to_string(),
                source_text: text,
                translated_text: None,
                recognized_text: None,
                translation_results: vec![],
                capture_rect: None,
            }),
        error: None,
    };
    Ok(Json(task))
}

async fn get_ocr_recognize(
    State(state): State<Arc<HttpApiState>>,
    Query(query): Query<CommonQuery>,
) -> Result<Json<TaskResponse>, AppError> {
    let runtime_settings = state.runtime_provider_settings()?;
    let source_lang_hint = query.source_lang_hint.clone();
    let provider_id = requested_ocr_provider_id(&query)
        .or_else(|| runtime_settings.default_runtime_ocr_provider_id());
    let request = TaskRequest::ocr_recognize_with_configs(
        source_lang_hint,
        provider_id,
        runtime_settings.ocr_provider_configs_option(),
    );
    let response = state.orchestrator.execute(request).await?;
    Ok(Json(response))
}

fn requested_ocr_provider_id(query: &CommonQuery) -> Option<String> {
    query
        .ocr_provider_id
        .clone()
        .or_else(|| query.provider_id.clone())
}

fn validate_translate_text(text: &str) -> Result<(), AppError> {
    if text.trim().is_empty() {
        return Err(AppError::new(
            ErrorCode::EmptyInput,
            "Input text is empty",
            false,
        ));
    }
    if text.chars().count() > MAX_TRANSLATE_TEXT_CHARS {
        return Err(AppError::new(
            ErrorCode::HttpInvalidRequest,
            format!(
                "Input text exceeds the {} character limit",
                MAX_TRANSLATE_TEXT_CHARS
            ),
            false,
        ));
    }
    Ok(())
}

async fn get_ocr_translate(
    State(state): State<Arc<HttpApiState>>,
    Query(query): Query<CommonQuery>,
) -> Result<Json<TaskResponse>, AppError> {
    let runtime_settings = state.runtime_provider_settings()?;
    let request = TaskRequest::ocr_translate(OcrTranslateTaskOptions {
        source_lang: query.source_lang,
        source_lang_hint: query.source_lang_hint,
        target_lang: query.target_lang,
        provider_id: query
            .provider_id
            .or_else(|| runtime_settings.default_translate_provider.clone()),
        ocr_provider_id: query
            .ocr_provider_id
            .or_else(|| runtime_settings.default_runtime_ocr_provider_id()),
        ocr_provider_configs: runtime_settings.ocr_provider_configs_option(),
        provider_configs: runtime_settings.translate_provider_configs_option(),
    });
    let response = state.orchestrator.execute(request).await?;
    Ok(Json(response))
}

#[cfg(test)]
mod tests {
    use super::{requested_ocr_provider_id, CommonQuery};

    #[test]
    fn prefers_explicit_ocr_provider_id() {
        let query = CommonQuery {
            source_lang: None,
            target_lang: None,
            provider_id: Some("legacy_provider".to_string()),
            source_lang_hint: None,
            ocr_provider_id: Some("openai_compatible_ocr".to_string()),
            text: None,
        };

        assert_eq!(
            requested_ocr_provider_id(&query),
            Some("openai_compatible_ocr".to_string())
        );
    }

    #[test]
    fn falls_back_to_provider_id_when_ocr_provider_id_is_missing() {
        let query = CommonQuery {
            source_lang: None,
            target_lang: None,
            provider_id: Some("legacy_provider".to_string()),
            source_lang_hint: None,
            ocr_provider_id: None,
            text: None,
        };

        assert_eq!(
            requested_ocr_provider_id(&query),
            Some("legacy_provider".to_string())
        );
    }
}
