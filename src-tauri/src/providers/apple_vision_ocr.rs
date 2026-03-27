use std::io::Write;
use std::process::{Child, Command, Output, Stdio};

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::providers::traits::{OcrProvider, OcrRequest, OcrResult};

const PROVIDER_ID: &str = "apple_vision";
const HELPER_EXECUTABLE: &str = "mydict-helper";
const HELPER_COMMAND: &str = "ocr.recognize";
const HELPER_PACKAGE_PATH: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../platform/macos/helper");

#[derive(Serialize)]
struct HelperRequest {
    command: String,
    payload: HelperPayload,
}

#[derive(Serialize)]
struct HelperPayload {
    #[serde(rename = "imagePath")]
    image_path: String,
    #[serde(rename = "sourceLangHint")]
    source_lang_hint: Option<String>,
}

#[derive(Deserialize)]
struct HelperResponse {
    ok: bool,
    data: Option<HelperData>,
    error: Option<HelperError>,
}

#[derive(Deserialize)]
struct HelperData {
    #[serde(rename = "providerId")]
    provider_id: Option<String>,
    #[serde(rename = "recognizedText")]
    recognized_text: Option<String>,
}

#[derive(Deserialize)]
struct HelperError {
    code: Option<String>,
    message: Option<String>,
    retryable: Option<bool>,
}

pub struct AppleVisionOcrProvider;

impl AppleVisionOcrProvider {
    pub fn new() -> Self {
        Self
    }

    fn ensure_helper_package_exists() -> Result<(), AppError> {
        if std::path::Path::new(HELPER_PACKAGE_PATH).exists() {
            return Ok(());
        }
        Err(AppError::new(
            ErrorCode::InternalError,
            format!("Helper package path not found: {HELPER_PACKAGE_PATH}"),
            false,
        ))
    }

    fn build_request(image_path: &str, source_lang_hint: Option<&str>) -> HelperRequest {
        HelperRequest {
            command: HELPER_COMMAND.to_string(),
            payload: HelperPayload {
                image_path: image_path.to_string(),
                source_lang_hint: source_lang_hint.map(ToString::to_string),
            },
        }
    }

    fn run_helper(request: &HelperRequest) -> Result<HelperResponse, AppError> {
        let mut child = Self::spawn_helper_process()?;
        let payload = Self::encode_helper_request(request)?;
        Self::write_helper_request(&mut child, &payload)?;
        let output = Self::wait_helper_output(child)?;
        Self::parse_helper_response(output)
    }

    fn spawn_helper_process() -> Result<Child, AppError> {
        Command::new("swift")
            .args([
                "run",
                "--package-path",
                HELPER_PACKAGE_PATH,
                HELPER_EXECUTABLE,
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| {
                AppError::new(
                    ErrorCode::InternalError,
                    format!("Failed to start OCR helper: {error}"),
                    false,
                )
            })
    }

    fn encode_helper_request(request: &HelperRequest) -> Result<Vec<u8>, AppError> {
        serde_json::to_vec(request).map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!("Failed to encode helper request: {error}"),
                false,
            )
        })
    }

    fn write_helper_request(child: &mut Child, payload: &[u8]) -> Result<(), AppError> {
        if let Some(stdin) = child.stdin.as_mut() {
            return stdin.write_all(payload).map_err(|error| {
                AppError::new(
                    ErrorCode::InternalError,
                    format!("Failed to write helper request: {error}"),
                    false,
                )
            });
        }
        Err(AppError::new(
            ErrorCode::InternalError,
            "OCR helper stdin is unavailable",
            false,
        ))
    }

    fn wait_helper_output(child: Child) -> Result<Output, AppError> {
        child.wait_with_output().map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!("Failed to read helper output: {error}"),
                false,
            )
        })
    }

    fn parse_helper_response(output: Output) -> Result<HelperResponse, AppError> {
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::new(
                ErrorCode::InternalError,
                format!("OCR helper process failed: {}", stderr.trim()),
                true,
            ));
        }

        serde_json::from_slice::<HelperResponse>(&output.stdout).map_err(|error| {
            AppError::new(
                ErrorCode::ProviderInvalidResponse,
                format!("Invalid OCR helper response: {error}"),
                false,
            )
        })
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
        Self::ensure_helper_package_exists()?;
        let response = Self::run_helper(&Self::build_request(
            &req.image_path,
            req.source_lang_hint.as_deref(),
        ))?;
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
        let recognized_text = data.recognized_text.unwrap_or_default().trim().to_string();
        if recognized_text.is_empty() {
            return Err(AppError::new(
                ErrorCode::OcrEmptyResult,
                "OCR helper returned empty text",
                false,
            ));
        }

        Ok(OcrResult {
            provider_id: data.provider_id.unwrap_or_else(|| PROVIDER_ID.to_string()),
            recognized_text,
        })
    }

    fn provider_id(&self) -> &'static str {
        PROVIDER_ID
    }
}
