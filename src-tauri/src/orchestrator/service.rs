use std::sync::Arc;

use tokio::sync::Mutex;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::orchestrator::models::{
    ProviderTranslationData, TaskData, TaskRequest, TaskResponse, TaskStatus, TaskType,
};
use crate::providers::registry::ProviderRegistry;
use crate::storage::config_store::ConfigStore;

pub(super) const DEFAULT_TRANSLATE_TIMEOUT_MS: u64 = 15000;
pub(super) const DEFAULT_OCR_TIMEOUT_MS: u64 = 20000;

pub(super) struct OcrExecution {
    pub provider_id: String,
    pub recognized_text: String,
    pub capture_rect: Option<crate::orchestrator::models::CaptureRect>,
}

pub struct Orchestrator {
    pub(super) active_task: Mutex<Option<String>>,
    pub(super) config_store: Arc<ConfigStore>,
    pub(super) providers: Arc<ProviderRegistry>,
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

    pub(super) async fn replace_active_task(&self, next: String) {
        let mut guard = self.active_task.lock().await;
        *guard = Some(next);
    }

    pub(super) fn accepted(task_id: String) -> TaskResponse {
        TaskResponse {
            ok: true,
            task_id,
            status: TaskStatus::Accepted,
            data: None,
            error: None,
        }
    }

    pub(super) fn failed(task_id: String, error: AppError) -> TaskResponse {
        TaskResponse {
            ok: false,
            task_id,
            status: TaskStatus::Failure,
            data: None,
            error: Some(error),
        }
    }

    pub(super) fn cancelled(task_id: String) -> TaskResponse {
        TaskResponse {
            ok: false,
            task_id,
            status: TaskStatus::Cancelled,
            data: None,
            error: None,
        }
    }

    pub(super) fn success(task_id: String, data: TaskData) -> TaskResponse {
        TaskResponse {
            ok: true,
            task_id,
            status: TaskStatus::Success,
            data: Some(data),
            error: None,
        }
    }

    pub(super) fn first_successful_translation(
        results: &[ProviderTranslationData],
    ) -> Option<&ProviderTranslationData> {
        results.iter().find(|item| item.error.is_none())
    }

    pub(super) fn first_translation_error(results: &[ProviderTranslationData]) -> AppError {
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
