use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::orchestrator::models::{CaptureRect, TaskData, TaskRequest, TaskResponse, TaskType};
use crate::orchestrator::ocr_text::normalize_ocr_text;
use crate::orchestrator::service::{OcrExecution, Orchestrator, DEFAULT_OCR_TIMEOUT_MS};
use crate::orchestrator::translation_execution::ProviderTranslationContext;
use crate::platform::capture::capture_interactive_image;
use crate::providers::traits::OcrRequest;

/// Context for captured OCR operations
pub struct CapturedOcrContext {
    pub request: TaskRequest,
    pub image_path: String,
    pub capture_rect: CaptureRect,
}

/// Context for OCR image processing
struct OcrImageContext<'a> {
    request: &'a TaskRequest,
    image_path: &'a str,
    capture_rect: CaptureRect,
}

impl Orchestrator {
    pub async fn execute_captured_ocr(
        &self,
        ctx: CapturedOcrContext,
    ) -> Result<TaskResponse, AppError> {
        self.replace_active_task(ctx.request.task_id.clone())
            .await;
        match ctx.request.task_type {
            TaskType::OcrRecognize => {
                self.handle_ocr_recognize_from_image(ctx).await
            }
            TaskType::OcrTranslate => {
                self.handle_ocr_translate_from_image(ctx).await
            }
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
        ctx: CapturedOcrContext,
    ) -> Result<TaskResponse, AppError> {
        let task_id = ctx.request.task_id.clone();
        let ocr = match self
            .execute_ocr_image(OcrImageContext {
                request: &ctx.request,
                image_path: &ctx.image_path,
                capture_rect: ctx.capture_rect,
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

        self.finish_ocr_translate(task_id, request, ocr).await
    }

    async fn handle_ocr_translate_from_image(
        &self,
        ctx: CapturedOcrContext,
    ) -> Result<TaskResponse, AppError> {
        let task_id = ctx.request.task_id.clone();
        let ocr = match self
            .execute_ocr_image(OcrImageContext {
                request: &ctx.request,
                image_path: &ctx.image_path,
                capture_rect: ctx.capture_rect,
            })
            .await
        {
            Ok(result) => result,
            Err(error) => return Ok(Self::failed(task_id, error)),
        };
        println!("[task:{task_id}] OCR: {}", ocr.recognized_text);

        self.finish_ocr_translate(task_id, ctx.request, ocr).await
    }

    async fn finish_ocr_translate(
        &self,
        task_id: String,
        request: TaskRequest,
        ocr: OcrExecution,
    ) -> Result<TaskResponse, AppError> {
        let providers = match self.pick_translate_providers(
            request.translate_provider_id.as_deref(),
            request.translate_provider_configs.as_deref(),
        ) {
            Ok(providers) => providers,
            Err(error) => return Ok(Self::failed(task_id, error)),
        };
        let source_lang = request
            .source_lang
            .unwrap_or_else(|| self.config_store.get().app.source_lang);
        let target_lang = request
            .target_lang
            .unwrap_or_else(|| self.config_store.get().app.target_lang);
        let translation_results = self
            .translate_with_providers(ProviderTranslationContext {
                providers: &providers,
                text: &ocr.recognized_text,
                source_lang: &source_lang,
                target_lang: &target_lang,
            })
            .await;
        let Some(primary_result) = Self::first_successful_translation(&translation_results) else {
            return Ok(Self::failed(
                task_id,
                Self::first_translation_error(&translation_results),
            ));
        };

        Ok(Self::success(
            task_id,
            TaskData {
                provider_id: primary_result.provider_id.clone(),
                source_text: ocr.recognized_text.clone(),
                translated_text: primary_result.translated_text.clone(),
                recognized_text: Some(ocr.recognized_text),
                translation_results,
                capture_rect: ocr.capture_rect,
            },
        ))
    }

    async fn execute_ocr_capture(&self, request: &TaskRequest) -> Result<OcrExecution, AppError> {
        let (image_path, capture_rect) = capture_interactive_image()?;
        let image_path_string = image_path.to_string_lossy().into_owned();
        let result = self.run_ocr_provider(request, &image_path_string).await;
        let _ = std::fs::remove_file(image_path);
        result.map(|mut ocr| {
            ocr.capture_rect = capture_rect;
            ocr
        })
    }

    async fn execute_ocr_image(
        &self,
        ctx: OcrImageContext<'_>,
    ) -> Result<OcrExecution, AppError> {
        let result = self.run_ocr_provider(ctx.request, ctx.image_path).await;
        let _ = std::fs::remove_file(ctx.image_path);
        result.map(|mut ocr| {
            ocr.capture_rect = Some(ctx.capture_rect);
            ocr
        })
    }

    async fn run_ocr_provider(
        &self,
        request: &TaskRequest,
        image_path: &str,
    ) -> Result<OcrExecution, AppError> {
        let ocr_provider = self.pick_ocr_provider(request.ocr_provider_id.as_deref())?;
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
