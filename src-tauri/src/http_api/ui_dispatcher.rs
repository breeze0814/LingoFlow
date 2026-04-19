use std::sync::Arc;

#[cfg(test)]
use std::sync::Mutex;

use crate::errors::app_error::AppError;
#[cfg(not(test))]
use crate::errors::error_code::ErrorCode;

#[cfg(not(test))]
use serde::Serialize;
#[cfg(not(test))]
use tauri::Emitter;

#[cfg(not(test))]
pub const OPEN_INPUT_TRANSLATE_EVENT: &str = "workspace://input_translate/open";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OpenInputTranslateRequest {
    pub text: Option<String>,
    pub source_lang: Option<String>,
    pub target_lang: Option<String>,
}

pub trait HttpUiDispatcher: Send + Sync {
    fn open_input_translate(&self, request: OpenInputTranslateRequest) -> Result<(), AppError>;
}

#[cfg(test)]
#[derive(Default)]
pub struct NoopHttpUiDispatcher;

#[cfg(test)]
impl HttpUiDispatcher for NoopHttpUiDispatcher {
    fn open_input_translate(&self, _request: OpenInputTranslateRequest) -> Result<(), AppError> {
        Ok(())
    }
}

pub type SharedHttpUiDispatcher = Arc<dyn HttpUiDispatcher>;

#[cfg(not(test))]
pub struct TauriHttpUiDispatcher<R: tauri::Runtime> {
    app: tauri::AppHandle<R>,
}

#[cfg(not(test))]
impl<R: tauri::Runtime> TauriHttpUiDispatcher<R> {
    pub fn new(app: tauri::AppHandle<R>) -> Self {
        Self { app }
    }
}

#[cfg(not(test))]
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenInputTranslatePayload {
    text: Option<String>,
    source_lang: Option<String>,
    target_lang: Option<String>,
}

#[cfg(not(test))]
impl<R: tauri::Runtime> HttpUiDispatcher for TauriHttpUiDispatcher<R> {
    fn open_input_translate(&self, request: OpenInputTranslateRequest) -> Result<(), AppError> {
        self.app
            .emit(
                OPEN_INPUT_TRANSLATE_EVENT,
                OpenInputTranslatePayload {
                    text: request.text,
                    source_lang: request.source_lang,
                    target_lang: request.target_lang,
                },
            )
            .map_err(|error| {
                AppError::new(
                    ErrorCode::InternalError,
                    format!("Failed to emit input translate UI event: {error}"),
                    true,
                )
            })
    }
}

#[cfg(test)]
pub struct RecordingHttpUiDispatcher {
    requests: Mutex<Vec<OpenInputTranslateRequest>>,
}

#[cfg(test)]
impl RecordingHttpUiDispatcher {
    pub fn new() -> Self {
        Self {
            requests: Mutex::new(Vec::new()),
        }
    }

    pub fn requests(&self) -> Vec<OpenInputTranslateRequest> {
        self.requests
            .lock()
            .unwrap_or_else(|poisoned| {
                eprintln!(
                    "RecordingHttpUiDispatcher lock poisoned during requests read, recovering"
                );
                poisoned.into_inner()
            })
            .clone()
    }
}

#[cfg(test)]
impl HttpUiDispatcher for RecordingHttpUiDispatcher {
    fn open_input_translate(&self, request: OpenInputTranslateRequest) -> Result<(), AppError> {
        self.requests
            .lock()
            .unwrap_or_else(|poisoned| {
                eprintln!(
                    "RecordingHttpUiDispatcher lock poisoned during request push, recovering"
                );
                poisoned.into_inner()
            })
            .push(request);
        Ok(())
    }
}
