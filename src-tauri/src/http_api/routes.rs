use std::sync::Arc;

use axum::extract::{Json, Query, State};
use axum::routing::{get, post};
use axum::Router;
use serde::Deserialize;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::orchestrator::models::{
    OcrTranslateTaskOptions, TaskCommandPayload, TaskRequest, TaskResponse, TranslateTaskOptions,
};
use crate::orchestrator::service::Orchestrator;

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

pub fn build_router(orchestrator: Arc<Orchestrator>) -> Router {
    Router::new()
        .route("/translate", post(post_translate))
        .route("/selection_translate", get(get_selection_translate))
        .route("/input_translate", get(get_input_translate))
        .route("/ocr_recognize", get(get_ocr_recognize))
        .route("/ocr_translate", get(get_ocr_translate))
        .with_state(orchestrator)
}

async fn post_translate(
    State(orchestrator): State<Arc<Orchestrator>>,
    Json(body): Json<TranslateBody>,
) -> Result<Json<TaskResponse>, AppError> {
    validate_translate_text(&body.text)?;
    let payload = TaskCommandPayload {
        text: Some(body.text),
        source_lang: body.source_lang,
        source_lang_hint: None,
        target_lang: body.target_lang,
        provider_id: body.provider_id,
        ocr_provider_id: None,
        translate_provider_configs: None,
    };
    let request = TaskRequest::input(
        payload.text,
        TranslateTaskOptions {
            source_lang: payload.source_lang,
            target_lang: payload.target_lang,
            provider_id: payload.provider_id,
            provider_configs: None,
        },
    );
    let response = orchestrator.execute(request).await?;
    Ok(Json(response))
}

async fn get_selection_translate(
    State(orchestrator): State<Arc<Orchestrator>>,
    Query(query): Query<CommonQuery>,
) -> Result<Json<TaskResponse>, AppError> {
    let request = TaskRequest::selection(query.target_lang, query.provider_id);
    let response = orchestrator.execute(request).await?;
    Ok(Json(response))
}

async fn get_input_translate(
    State(_orchestrator): State<Arc<Orchestrator>>,
    Query(query): Query<CommonQuery>,
) -> Result<Json<TaskResponse>, AppError> {
    if let Some(text) = query.text.as_deref() {
        validate_translate_text(text)?;
    }
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
    State(orchestrator): State<Arc<Orchestrator>>,
    Query(query): Query<CommonQuery>,
) -> Result<Json<TaskResponse>, AppError> {
    let request = TaskRequest::ocr_recognize(query.source_lang_hint, query.provider_id);
    let response = orchestrator.execute(request).await?;
    Ok(Json(response))
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
    State(orchestrator): State<Arc<Orchestrator>>,
    Query(query): Query<CommonQuery>,
) -> Result<Json<TaskResponse>, AppError> {
    let request = TaskRequest::ocr_translate(OcrTranslateTaskOptions {
        source_lang: query.source_lang,
        source_lang_hint: query.source_lang_hint,
        target_lang: query.target_lang,
        provider_id: query.provider_id,
        ocr_provider_id: query.ocr_provider_id,
        provider_configs: None,
    });
    let response = orchestrator.execute(request).await?;
    Ok(Json(response))
}
