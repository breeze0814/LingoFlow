use std::collections::HashMap;
use std::sync::Mutex as StdMutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::{oneshot, Mutex};
use uuid::Uuid;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::providers::base64::encode_base64;
use crate::providers::traits::OcrRequest;

pub const OCR_RUNTIME_WINDOW_LABEL: &str = "ocr_runtime";
pub const OCR_RUNTIME_REQUEST_EVENT: &str = "ocr://runtime/request";

type PendingMap = HashMap<String, oneshot::Sender<Result<String, AppError>>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TesseractOcrRequestPayload {
    pub request_id: String,
    pub image_data_url: String,
    pub source_lang_hint: Option<String>,
    pub timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TesseractOcrResponsePayload {
    pub request_id: String,
    pub recognized_text: Option<String>,
    pub error: Option<TesseractOcrErrorPayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TesseractOcrErrorPayload {
    pub code: ErrorCode,
    pub message: String,
    pub retryable: bool,
}

pub struct TesseractJsBridge {
    app: StdMutex<Option<AppHandle>>,
    pending: Mutex<PendingMap>,
}

impl TesseractJsBridge {
    pub fn new() -> Self {
        Self {
            app: StdMutex::new(None),
            pending: Mutex::new(HashMap::new()),
        }
    }

    pub fn attach_app(&self, app: AppHandle) {
        if let Ok(mut guard) = self.app.lock() {
            *guard = Some(app);
        }
    }

    pub async fn recognize(&self, req: OcrRequest) -> Result<String, AppError> {
        let request_id = Uuid::new_v4().to_string();
        let payload = self.build_request_payload(&request_id, &req).await?;
        let receiver = self.register_pending_request(&request_id).await;
        self.emit_request(payload)?;
        self.wait_for_response(request_id, req.timeout_ms, receiver)
            .await
    }

    pub async fn resolve(&self, payload: TesseractOcrResponsePayload) {
        let sender = {
            let mut pending = self.pending.lock().await;
            pending.remove(&payload.request_id)
        };
        let Some(sender) = sender else {
            return;
        };
        let _ = sender.send(map_response_payload(payload));
    }

    async fn build_request_payload(
        &self,
        request_id: &str,
        req: &OcrRequest,
    ) -> Result<TesseractOcrRequestPayload, AppError> {
        Ok(TesseractOcrRequestPayload {
            request_id: request_id.to_string(),
            image_data_url: read_image_data_url_blocking(req.image_path.clone()).await?,
            source_lang_hint: req.source_lang_hint.clone(),
            timeout_ms: req.timeout_ms,
        })
    }

    async fn register_pending_request(
        &self,
        request_id: &str,
    ) -> oneshot::Receiver<Result<String, AppError>> {
        let (sender, receiver) = oneshot::channel();
        let mut pending = self.pending.lock().await;
        pending.insert(request_id.to_string(), sender);
        receiver
    }

    fn emit_request(&self, payload: TesseractOcrRequestPayload) -> Result<(), AppError> {
        let app = self.require_app()?;
        let window = app
            .get_webview_window(OCR_RUNTIME_WINDOW_LABEL)
            .ok_or_else(|| {
                AppError::new(
                    ErrorCode::InternalError,
                    "Tesseract OCR runtime window is unavailable",
                    true,
                )
            })?;

        window
            .emit(OCR_RUNTIME_REQUEST_EVENT, payload)
            .map_err(|error| {
                AppError::new(
                    ErrorCode::InternalError,
                    format!("Failed to dispatch OCR request to runtime window: {error}"),
                    true,
                )
            })
    }

    async fn wait_for_response(
        &self,
        request_id: String,
        timeout_ms: u64,
        receiver: oneshot::Receiver<Result<String, AppError>>,
    ) -> Result<String, AppError> {
        match tokio::time::timeout(Duration::from_millis(timeout_ms), receiver).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => {
                self.remove_pending_request(&request_id).await;
                Err(AppError::new(
                    ErrorCode::InternalError,
                    "Tesseract OCR runtime closed response channel unexpectedly",
                    true,
                ))
            }
            Err(_) => {
                self.remove_pending_request(&request_id).await;
                Err(AppError::new(
                    ErrorCode::ProviderTimeout,
                    "Tesseract OCR request timed out",
                    true,
                ))
            }
        }
    }

    async fn remove_pending_request(&self, request_id: &str) {
        let mut pending = self.pending.lock().await;
        pending.remove(request_id);
    }

    fn require_app(&self) -> Result<AppHandle, AppError> {
        let guard = self.app.lock().map_err(|_| {
            AppError::new(
                ErrorCode::InternalError,
                "Tesseract OCR runtime state lock is poisoned",
                false,
            )
        })?;
        guard.clone().ok_or_else(|| {
            AppError::new(
                ErrorCode::InternalError,
                "Tesseract OCR runtime has not been attached to the app",
                true,
            )
        })
    }
}

fn read_image_data_url(image_path: &str) -> Result<String, AppError> {
    let bytes = std::fs::read(image_path).map_err(|error| {
        AppError::new(
            ErrorCode::InternalError,
            format!("Failed to read captured image for Tesseract OCR: {error}"),
            false,
        )
    })?;
    if bytes.is_empty() {
        return Err(AppError::new(
            ErrorCode::OcrEmptyResult,
            "Captured image is empty",
            false,
        ));
    }
    Ok(format!("data:image/png;base64,{}", encode_base64(&bytes)))
}

async fn read_image_data_url_blocking(image_path: String) -> Result<String, AppError> {
    tokio::task::spawn_blocking(move || read_image_data_url(&image_path))
        .await
        .map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!("Tesseract OCR image read task failed to join: {error}"),
                true,
            )
        })?
}

fn map_response_payload(payload: TesseractOcrResponsePayload) -> Result<String, AppError> {
    if let Some(error) = payload.error {
        return Err(AppError::new(error.code, error.message, error.retryable));
    }

    payload.recognized_text.ok_or_else(|| {
        AppError::new(
            ErrorCode::ProviderInvalidResponse,
            "Tesseract OCR runtime returned neither text nor error",
            false,
        )
    })
}
