#![cfg_attr(test, allow(dead_code))]

use std::path::PathBuf;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::orchestrator::models::{CaptureRect, TaskData, TaskRequest, TaskResponse, TaskType};
use crate::orchestrator::ocr_text::normalize_ocr_text;
use crate::orchestrator::service::{OcrExecution, Orchestrator, DEFAULT_OCR_TIMEOUT_MS};
use crate::orchestrator::translation_execution::ProviderTranslationContext;
use crate::platform::capture::capture_interactive_image;
use crate::providers::traits::OcrRequest;

pub struct CapturedOcrInput {
    pub request: TaskRequest,
    pub image_path: String,
    pub capture_rect: crate::orchestrator::models::CaptureRect,
}

struct OcrTranslateCompletionArgs {
    task_id: String,
    request: TaskRequest,
    ocr: OcrExecution,
}

struct OcrImageInput<'a> {
    request: &'a TaskRequest,
    image_path: &'a str,
    capture_rect: crate::orchestrator::models::CaptureRect,
}

impl Orchestrator {
    pub async fn execute_captured_ocr(
        &self,
        input: CapturedOcrInput,
    ) -> Result<TaskResponse, AppError> {
        self.replace_active_task(input.request.task_id.clone())
            .await;
        match input.request.task_type {
            TaskType::OcrRecognize => self.handle_ocr_recognize_from_image(input).await,
            TaskType::OcrTranslate => self.handle_ocr_translate_from_image(input).await,
            _ => Err(AppError::new(
                ErrorCode::InternalError,
                "Captured OCR execution only supports OCR tasks",
                false,
            )),
        }
    }

    pub(super) async fn handle_ocr_recognize(
        &self,
        request: TaskRequest,
    ) -> Result<TaskResponse, AppError> {
        let task_id = request.task_id.clone();
        let ocr = match self.execute_ocr_capture(&request).await {
            Ok(result) => result,
            Err(error) => {
                if matches!(error.code, ErrorCode::UserCancelled) {
                    return Ok(Self::cancelled(task_id));
                }
                return Ok(Self::failed(task_id, error));
            }
        };
        println!("[task:{task_id}] OCR: {}", ocr.recognized_text);

        Ok(Self::success(task_id, ocr_recognize_task_data(ocr)))
    }

    async fn handle_ocr_recognize_from_image(
        &self,
        input: CapturedOcrInput,
    ) -> Result<TaskResponse, AppError> {
        let task_id = input.request.task_id.clone();
        let ocr = match self
            .execute_ocr_image(OcrImageInput {
                request: &input.request,
                image_path: &input.image_path,
                capture_rect: input.capture_rect,
            })
            .await
        {
            Ok(result) => result,
            Err(error) => return Ok(Self::failed(task_id, error)),
        };
        println!("[task:{task_id}] OCR: {}", ocr.recognized_text);

        Ok(Self::success(task_id, ocr_recognize_task_data(ocr)))
    }

    pub(super) async fn handle_ocr_translate(
        &self,
        request: TaskRequest,
    ) -> Result<TaskResponse, AppError> {
        let task_id = request.task_id.clone();
        let ocr = match self.execute_ocr_capture(&request).await {
            Ok(result) => result,
            Err(error) => {
                if matches!(error.code, ErrorCode::UserCancelled) {
                    return Ok(Self::cancelled(task_id));
                }
                return Ok(Self::failed(task_id, error));
            }
        };
        println!("[task:{task_id}] OCR: {}", ocr.recognized_text);

        self.finish_ocr_translate(OcrTranslateCompletionArgs {
            task_id,
            request,
            ocr,
        })
        .await
    }

    async fn handle_ocr_translate_from_image(
        &self,
        input: CapturedOcrInput,
    ) -> Result<TaskResponse, AppError> {
        let task_id = input.request.task_id.clone();
        let ocr = match self
            .execute_ocr_image(OcrImageInput {
                request: &input.request,
                image_path: &input.image_path,
                capture_rect: input.capture_rect,
            })
            .await
        {
            Ok(result) => result,
            Err(error) => return Ok(Self::failed(task_id, error)),
        };
        println!("[task:{task_id}] OCR: {}", ocr.recognized_text);

        self.finish_ocr_translate(OcrTranslateCompletionArgs {
            task_id,
            request: input.request,
            ocr,
        })
        .await
    }

    async fn finish_ocr_translate(
        &self,
        args: OcrTranslateCompletionArgs,
    ) -> Result<TaskResponse, AppError> {
        let providers = match self.pick_translate_providers(
            args.request.translate_provider_id.as_deref(),
            args.request.translate_provider_configs.as_deref(),
        ) {
            Ok(providers) => providers,
            Err(error) => return Ok(Self::failed(args.task_id, error)),
        };
        let source_lang = args
            .request
            .source_lang
            .unwrap_or_else(|| self.config_store.get().app.source_lang);
        let target_lang = args
            .request
            .target_lang
            .unwrap_or_else(|| self.config_store.get().app.target_lang);
        let translation_results = self
            .translate_with_providers(
                crate::orchestrator::translation_execution::TranslateBatchArgs {
                    providers: &providers,
                    text: &args.ocr.recognized_text,
                    source_lang: source_lang.as_str(),
                    target_lang: target_lang.as_str(),
                },
            )
            .await;
        let Some(primary_result) = Self::first_successful_translation(&translation_results) else {
            return Ok(Self::failed(
                args.task_id,
                Self::first_translation_error(&translation_results),
            ));
        };

        Ok(Self::success(
            args.task_id,
            TaskData {
                provider_id: primary_result.provider_id.clone(),
                source_text: args.ocr.recognized_text.clone(),
                translated_text: primary_result.translated_text.clone(),
                recognized_text: Some(args.ocr.recognized_text),
                translation_results,
                capture_rect: args.ocr.capture_rect,
            },
        ))
    }

    async fn execute_ocr_capture(&self, request: &TaskRequest) -> Result<OcrExecution, AppError> {
        let (image_path, capture_rect) = capture_interactive_image_blocking().await?;
        let image_path_string = image_path.to_string_lossy().into_owned();
        let result = self.run_ocr_provider(request, &image_path_string).await;
        remove_file_best_effort(image_path).await;
        result.map(|mut ocr| {
            ocr.capture_rect = capture_rect;
            ocr
        })
    }

    async fn execute_ocr_image(&self, input: OcrImageInput<'_>) -> Result<OcrExecution, AppError> {
        let image_path = input.image_path.to_string();
        let result = self.run_ocr_provider(input.request, input.image_path).await;
        remove_file_best_effort(PathBuf::from(image_path)).await;
        result.map(|mut ocr| {
            ocr.capture_rect = Some(input.capture_rect);
            ocr
        })
    }

    async fn run_ocr_provider(
        &self,
        request: &TaskRequest,
        image_path: &str,
    ) -> Result<OcrExecution, AppError> {
        let ocr_provider = self.pick_ocr_provider(
            request.ocr_provider_id.as_deref(),
            request.ocr_provider_configs.as_deref(),
        )?;
        let ocr_request = OcrRequest {
            image_path: image_path.to_string(),
            source_lang_hint: request.source_lang_hint.clone(),
            timeout_ms: DEFAULT_OCR_TIMEOUT_MS,
        };
        let ocr_result = ocr_provider.recognize(ocr_request).await?;
        let recognized_text = normalize_ocr_text(&ocr_result.recognized_text);
        if recognized_text.is_empty() {
            return Err(AppError::new(
                ErrorCode::OcrEmptyResult,
                "OCR provider returned empty text",
                false,
            ));
        }
        Ok(OcrExecution {
            provider_id: ocr_result.provider_id,
            recognized_text,
            capture_rect: None,
        })
    }
}

fn ocr_recognize_task_data(ocr: OcrExecution) -> TaskData {
    TaskData {
        provider_id: ocr.provider_id,
        source_text: ocr.recognized_text.clone(),
        translated_text: None,
        recognized_text: Some(ocr.recognized_text),
        translation_results: vec![],
        capture_rect: ocr.capture_rect,
    }
}

async fn capture_interactive_image_blocking(
) -> Result<(PathBuf, Option<crate::orchestrator::models::CaptureRect>), AppError> {
    tokio::task::spawn_blocking(capture_interactive_image)
        .await
        .map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!("Capture task failed to join: {error}"),
                true,
            )
        })?
}

async fn remove_file_best_effort(path: PathBuf) {
    let _ = tokio::task::spawn_blocking(move || std::fs::remove_file(path)).await;
}
