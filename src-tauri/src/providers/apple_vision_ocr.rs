use async_trait::async_trait;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::platform::macos_helper::{run_helper, HelperError, HelperPayload};
use crate::providers::traits::{OcrProvider, OcrRequest, OcrResult};

const PROVIDER_ID: &str = "apple_vision";
const HELPER_COMMAND: &str = "ocr.recognize";

pub struct AppleVisionOcrProvider;

impl AppleVisionOcrProvider {
    pub fn new() -> Self {
        Self
    }

    fn map_helper_error(error: Option<HelperError>) -> AppError {
        let code = error
            .as_ref()
            .and_then(|item| item.code.as_deref())
            .unwrap_or("ocr_execution_failed");
        let message = error
            .as_ref()
            .and_then(|item| item.message.as_deref())
            .unwrap_or("OCR helper execution failed")
            .to_string();
        let retryable = error
            .as_ref()
            .and_then(|item| item.retryable)
            .unwrap_or(true);

        if code == "ocr_empty_result" {
            return AppError::new(ErrorCode::OcrEmptyResult, message, false);
        }
        if code == "invalid_request" {
            return AppError::new(ErrorCode::ProviderInvalidResponse, message, false);
        }
        AppError::new(ErrorCode::InternalError, message, retryable)
    }
}

#[async_trait]
impl OcrProvider for AppleVisionOcrProvider {
    async fn recognize(&self, req: OcrRequest) -> Result<OcrResult, AppError> {
        let response = run_helper_blocking(req).await?;
        if !response.ok {
            return Err(Self::map_helper_error(response.error));
        }
        let data = response.data.ok_or_else(|| {
            AppError::new(
                ErrorCode::ProviderInvalidResponse,
                "OCR helper response missing data",
                false,
            )
        })?;
        let recognized_text = data
            .get("recognizedText")
            .map(String::as_str)
            .unwrap_or_default()
            .trim()
            .to_string();
        if recognized_text.is_empty() {
            return Err(AppError::new(
                ErrorCode::OcrEmptyResult,
                "OCR helper returned empty text",
                false,
            ));
        }

        Ok(OcrResult {
            provider_id: data
                .get("providerId")
                .cloned()
                .unwrap_or_else(|| PROVIDER_ID.to_string()),
            recognized_text,
        })
    }

    fn provider_id(&self) -> &'static str {
        PROVIDER_ID
    }
}

async fn run_helper_blocking(req: OcrRequest) -> Result<crate::platform::macos_helper::HelperResponse, AppError> {
    tokio::task::spawn_blocking(move || {
        run_helper(
            HELPER_COMMAND,
            Some(HelperPayload {
                image_path: Some(req.image_path),
                source_lang_hint: req.source_lang_hint,
            }),
        )
    })
    .await
    .map_err(|error| {
        AppError::new(
            ErrorCode::InternalError,
            format!("OCR helper task failed to join: {error}"),
            true,
        )
    })?
}
