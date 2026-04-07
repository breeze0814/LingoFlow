use std::sync::Arc;

use tokio::sync::Mutex;

#[path = "service_ocr.rs"]
mod service_ocr;
#[path = "service_translation.rs"]
mod service_translation;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::orchestrator::models::{TaskData, TaskRequest, TaskResponse, TaskStatus, TaskType};
use crate::providers::registry::ProviderRegistry;
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

    fn success(task_id: String, data: TaskData) -> TaskResponse {
        TaskResponse {
            ok: true,
            task_id,
            status: TaskStatus::Success,
            data: Some(data),
            error: None,
        }
    }
}
