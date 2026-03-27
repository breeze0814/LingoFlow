use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    PermissionDenied,
    NoSelection,
    EmptyInput,
    UserCancelled,
    ProviderNotConfigured,
    ProviderNotEnabled,
    ProviderAuthError,
    ProviderNetworkError,
    ProviderTimeout,
    ProviderRateLimited,
    ProviderInvalidResponse,
    OcrEmptyResult,
    HttpInvalidRequest,
    HttpPortInUse,
    InternalError,
}
