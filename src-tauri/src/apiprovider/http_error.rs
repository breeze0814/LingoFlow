use reqwest::StatusCode;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;

pub fn map_http_error(provider_label: &str, error: reqwest::Error) -> AppError {
    if error.is_timeout() {
        return AppError::new(
            ErrorCode::ProviderTimeout,
            format!("{provider_label} request timed out"),
            true,
        );
    }

    if let Some(status) = error.status() {
        return map_status_error(provider_label, status);
    }

    AppError::new(
        ErrorCode::ProviderNetworkError,
        format!("{provider_label} request failed: {error}"),
        true,
    )
}

fn map_status_error(provider_label: &str, status: StatusCode) -> AppError {
    match status {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => AppError::new(
            ErrorCode::ProviderAuthError,
            format!("{provider_label} authentication failed"),
            false,
        ),
        StatusCode::TOO_MANY_REQUESTS => AppError::new(
            ErrorCode::ProviderRateLimited,
            format!("{provider_label} rate limit reached"),
            true,
        ),
        _ => AppError::new(
            ErrorCode::ProviderNetworkError,
            format!("{provider_label} returned status {status}"),
            true,
        ),
    }
}

pub fn invalid_response_error(provider_label: &str, detail: impl Into<String>) -> AppError {
    AppError::new(
        ErrorCode::ProviderInvalidResponse,
        format!("{provider_label} invalid response: {}", detail.into()),
        false,
    )
}
