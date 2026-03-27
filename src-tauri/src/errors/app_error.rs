use serde::{Deserialize, Serialize};

use crate::errors::error_code::ErrorCode;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize, thiserror::Error)]
#[error("{message}")]
pub struct AppError {
    pub code: ErrorCode,
    pub message: String,
    pub retryable: bool,
}

impl AppError {
    pub fn new(code: ErrorCode, message: impl Into<String>, retryable: bool) -> Self {
        Self {
            code,
            message: message.into(),
            retryable,
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = status_code_for(&self.code);
        let body = Json(json!({
            "ok": false,
            "status": "failure",
            "error": {
                "code": self.code,
                "message": self.message,
                "retryable": self.retryable
            }
        }));
        (status, body).into_response()
    }
}

fn status_code_for(code: &ErrorCode) -> StatusCode {
    match code {
        ErrorCode::HttpInvalidRequest | ErrorCode::EmptyInput | ErrorCode::NoSelection => {
            StatusCode::BAD_REQUEST
        }
        ErrorCode::HttpPortInUse => StatusCode::CONFLICT,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    }
}
