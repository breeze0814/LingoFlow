use std::sync::Arc;

use tokio::sync::Mutex;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::orchestrator::models::{
    ProviderTranslationData, TaskData, TaskRequest, TaskResponse, TaskStatus, TaskType,
};
use crate::orchestrator::ocr_text::normalize_ocr_text;
use crate::platform::capture::capture_interactive_image;
use crate::providers::registry::ProviderRegistry;
use crate::providers::runtime_translate_factory::{
    build_runtime_translate_targets, TranslateExecutionTarget,
};
use crate::providers::traits::{OcrRequest, TranslateRequest};
use crate::storage::config_store::ConfigStore;

const DEFAULT_TRANSLATE_TIMEOUT_MS: u64 = 15000;
const DEFAULT_OCR_TIMEOUT_MS: u64 = 20000;

struct OcrExecution {
    provider_id: String,
    recognized_text: String,
    capture_rect: Option<crate::orchestrator::models::CaptureRect>,
}

pub struct Orchestrator {
    active_task: Mutex<Option<String>>,
    config_store: Arc<ConfigStore>,
    providers: Arc<ProviderRegistry>,
}

impl Orchestrator {
    pub fn new(config_store: Arc<ConfigStore>, providers: Arc<ProviderRegistry>) -> Self {
        Self {
            active_task: Mutex::new(None),
            config_store,
            providers,
        }
    }

    pub async fn execute(&self, request: TaskRequest) -> Result<TaskResponse, AppError> {
        self.replace_active_task(request.task_id.clone()).await;
        match request.task_type {
            TaskType::OpenInputPanel => Ok(Self::accepted(request.task_id)),
            TaskType::InputTranslate => self.handle_input_translate(request).await,
            TaskType::SelectionTranslate => self.handle_selection_translate(request).await,
            TaskType::OcrRecognize => self.handle_ocr_recognize(request).await,
            TaskType::OcrTranslate => self.handle_ocr_translate(request).await,
        }
    }

    pub async fn execute_captured_ocr(
        &self,
        request: TaskRequest,
        image_path: String,
        capture_rect: crate::orchestrator::models::CaptureRect,
    ) -> Result<TaskResponse, AppError> {
        self.replace_active_task(request.task_id.clone()).await;
        match request.task_type {
            TaskType::OcrRecognize => {
                self.handle_ocr_recognize_from_image(request, image_path, capture_rect)
                    .await
            }
            TaskType::OcrTranslate => {
                self.handle_ocr_translate_from_image(request, image_path, capture_rect)
                    .await
            }
            _ => Err(AppError::new(
                ErrorCode::InternalError,
                "Captured OCR execution only supports OCR tasks",
                false,
            )),
        }
    }

    async fn replace_active_task(&self, next: String) {
        let mut guard = self.active_task.lock().await;
        *guard = Some(next);
    }

    async fn handle_input_translate(&self, request: TaskRequest) -> Result<TaskResponse, AppError> {
        let task_id = request.task_id.clone();
        let text = request.text.clone().unwrap_or_default();
        self.translate_text(request, task_id, text).await
    }

    async fn handle_selection_translate(
        &self,
        request: TaskRequest,
    ) -> Result<TaskResponse, AppError> {
        let task_id = request.task_id.clone();
        let text = match crate::platform::selection::read_selected_text() {
            Ok(text) => text,
            Err(error) => return Ok(Self::failed(task_id, error)),
        };
        self.translate_text(request, task_id, text).await
    }

    async fn translate_text(
        &self,
        request: TaskRequest,
        task_id: String,
        text: String,
    ) -> Result<TaskResponse, AppError> {
        if text.trim().is_empty() {
            return Ok(Self::failed(
                task_id,
                AppError::new(ErrorCode::EmptyInput, "Input text is empty", false),
            ));
        }
        let source_lang = request
            .source_lang
            .unwrap_or_else(|| self.config_store.get().app.source_lang);
        let target_lang = request
            .target_lang
            .unwrap_or_else(|| self.config_store.get().app.target_lang);
        let providers = match self.pick_translate_providers(
            request.translate_provider_id.as_deref(),
            request.translate_provider_configs.as_deref(),
        ) {
            Ok(providers) => providers,
            Err(error) => return Ok(Self::failed(task_id, error)),
        };
        let translation_results = self
            .translate_with_providers(
                &providers,
                &text,
                source_lang.as_str(),
                target_lang.as_str(),
            )
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
                source_text: text,
                translated_text: primary_result.translated_text.clone(),
                recognized_text: None,
                translation_results,
                capture_rect: None,
            },
        ))
    }

    async fn handle_ocr_recognize(&self, request: TaskRequest) -> Result<TaskResponse, AppError> {
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

        Ok(Self::success(
            task_id,
            TaskData {
                provider_id: ocr.provider_id,
                source_text: ocr.recognized_text.clone(),
                translated_text: None,
                recognized_text: Some(ocr.recognized_text),
                translation_results: vec![],
                capture_rect: ocr.capture_rect,
            },
        ))
    }

    async fn handle_ocr_recognize_from_image(
        &self,
        request: TaskRequest,
        image_path: String,
        capture_rect: crate::orchestrator::models::CaptureRect,
    ) -> Result<TaskResponse, AppError> {
        let task_id = request.task_id.clone();
        let ocr = match self
            .execute_ocr_image(&request, &image_path, capture_rect)
            .await
        {
            Ok(result) => result,
            Err(error) => return Ok(Self::failed(task_id, error)),
        };
        println!("[task:{task_id}] OCR: {}", ocr.recognized_text);

        Ok(Self::success(
            task_id,
            TaskData {
                provider_id: ocr.provider_id,
                source_text: ocr.recognized_text.clone(),
                translated_text: None,
                recognized_text: Some(ocr.recognized_text),
                translation_results: vec![],
                capture_rect: ocr.capture_rect,
            },
        ))
    }

    async fn handle_ocr_translate(&self, request: TaskRequest) -> Result<TaskResponse, AppError> {
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
            .translate_with_providers(
                &providers,
                &ocr.recognized_text,
                source_lang.as_str(),
                target_lang.as_str(),
            )
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

    async fn handle_ocr_translate_from_image(
        &self,
        request: TaskRequest,
        image_path: String,
        capture_rect: crate::orchestrator::models::CaptureRect,
    ) -> Result<TaskResponse, AppError> {
        let task_id = request.task_id.clone();
        let ocr = match self
            .execute_ocr_image(&request, &image_path, capture_rect)
            .await
        {
            Ok(result) => result,
            Err(error) => return Ok(Self::failed(task_id, error)),
        };
        println!("[task:{task_id}] OCR: {}", ocr.recognized_text);

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
            .translate_with_providers(
                &providers,
                &ocr.recognized_text,
                source_lang.as_str(),
                target_lang.as_str(),
            )
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

    fn accepted(task_id: String) -> TaskResponse {
        TaskResponse {
            ok: true,
            task_id,
            status: TaskStatus::Accepted,
            data: None,
            error: None,
        }
    }

    fn failed(task_id: String, error: AppError) -> TaskResponse {
        TaskResponse {
            ok: false,
            task_id,
            status: TaskStatus::Failure,
            data: None,
            error: Some(error),
        }
    }

    fn cancelled(task_id: String) -> TaskResponse {
        TaskResponse {
            ok: false,
            task_id,
            status: TaskStatus::Cancelled,
            data: None,
            error: None,
        }
    }

    #[allow(dead_code)]
    fn success(task_id: String, data: TaskData) -> TaskResponse {
        TaskResponse {
            ok: true,
            task_id,
            status: TaskStatus::Success,
            data: Some(data),
            error: None,
        }
    }

    fn pick_translate_provider(
        &self,
        requested_provider_id: Option<&str>,
    ) -> Result<Arc<dyn crate::providers::traits::TranslateProvider>, AppError> {
        if let Some(provider_id) = requested_provider_id {
            if let Some(provider) = self.providers.translate_provider_by_id(provider_id) {
                return Ok(provider);
            }
            return Err(AppError::new(
                ErrorCode::ProviderNotEnabled,
                format!("Translate provider `{provider_id}` is not enabled"),
                false,
            ));
        }
        self.providers.default_translate_provider().ok_or_else(|| {
            AppError::new(
                ErrorCode::ProviderNotConfigured,
                "No translate provider configured. Please configure at least one API provider key.",
                false,
            )
        })
    }

    fn pick_translate_providers(
        &self,
        requested_provider_id: Option<&str>,
        runtime_configs: Option<
            &[crate::apiprovider::runtime_config::TranslateProviderRuntimeConfig],
        >,
    ) -> Result<Vec<TranslateExecutionTarget>, AppError> {
        if let Some(configs) = runtime_configs {
            let providers = if let Some(provider_id) = requested_provider_id {
                let targets = build_runtime_translate_targets(configs);
                let filtered = targets
                    .into_iter()
                    .filter(|target| target.provider_id() == provider_id)
                    .collect::<Vec<TranslateExecutionTarget>>();
                if filtered.is_empty() {
                    return Err(AppError::new(
                        ErrorCode::ProviderNotEnabled,
                        format!("Translate provider `{provider_id}` is not enabled"),
                        false,
                    ));
                }
                filtered
            } else {
                build_runtime_translate_targets(configs)
            };
            if providers.is_empty() {
                return Err(AppError::new(
                    ErrorCode::ProviderNotConfigured,
                    "No translate provider configured.",
                    false,
                ));
            }
            return Ok(providers);
        }
        if let Some(provider_id) = requested_provider_id {
            let provider = self.pick_translate_provider(Some(provider_id))?;
            return Ok(vec![TranslateExecutionTarget::Ready {
                provider_id: provider_id.to_string(),
                provider,
            }]);
        }
        let providers = self.providers.all_translate_providers();
        if providers.is_empty() {
            return Err(AppError::new(
                ErrorCode::ProviderNotConfigured,
                "No translate provider configured. Please configure at least one API provider key.",
                false,
            ));
        }
        Ok(providers
            .into_iter()
            .map(|(provider_id, provider)| TranslateExecutionTarget::Ready {
                provider_id,
                provider,
            })
            .collect())
    }

    fn pick_ocr_provider(
        &self,
        requested_provider_id: Option<&str>,
    ) -> Result<Arc<dyn crate::providers::traits::OcrProvider>, AppError> {
        if let Some(provider_id) = requested_provider_id {
            if let Some(provider) = self.providers.ocr_provider_by_id(provider_id) {
                return Ok(provider);
            }
            return Err(AppError::new(
                ErrorCode::ProviderNotEnabled,
                format!("OCR provider `{provider_id}` is not enabled"),
                false,
            ));
        }
        self.providers.default_ocr_provider().ok_or_else(|| {
            AppError::new(
                ErrorCode::ProviderNotConfigured,
                "No OCR provider configured.",
                false,
            )
        })
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
        request: &TaskRequest,
        image_path: &str,
        capture_rect: crate::orchestrator::models::CaptureRect,
    ) -> Result<OcrExecution, AppError> {
        let result = self.run_ocr_provider(request, image_path).await;
        let _ = std::fs::remove_file(image_path);
        result.map(|mut ocr| {
            ocr.capture_rect = Some(capture_rect);
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

    async fn translate_with_providers(
        &self,
        providers: &[TranslateExecutionTarget],
        text: &str,
        source_lang: &str,
        target_lang: &str,
    ) -> Vec<ProviderTranslationData> {
        let mut results = Vec::with_capacity(providers.len());
        for target in providers {
            let result = match target {
                TranslateExecutionTarget::Ready {
                    provider_id,
                    provider,
                } => {
                    let request = TranslateRequest {
                        text: text.to_string(),
                        source_lang: source_lang.to_string(),
                        target_lang: target_lang.to_string(),
                        timeout_ms: DEFAULT_TRANSLATE_TIMEOUT_MS,
                    };
                    match provider.translate(request).await {
                        Ok(translation) => ProviderTranslationData {
                            provider_id: provider_id.clone(),
                            translated_text: Some(translation.translated_text),
                            error: None,
                        },
                        Err(error) => ProviderTranslationData {
                            provider_id: provider_id.clone(),
                            translated_text: None,
                            error: Some(error),
                        },
                    }
                }
                TranslateExecutionTarget::BuildError { provider_id, error } => {
                    ProviderTranslationData {
                        provider_id: provider_id.clone(),
                        translated_text: None,
                        error: Some(error.clone()),
                    }
                }
            };
            results.push(result);
        }
        results
    }

    fn first_successful_translation(
        results: &[ProviderTranslationData],
    ) -> Option<&ProviderTranslationData> {
        results.iter().find(|item| item.error.is_none())
    }

    fn first_translation_error(results: &[ProviderTranslationData]) -> AppError {
        results
            .iter()
            .find_map(|item| item.error.clone())
            .unwrap_or_else(|| {
                AppError::new(
                    ErrorCode::ProviderNetworkError,
                    "All translate providers failed without returning an explicit error",
                    true,
                )
            })
    }
}
