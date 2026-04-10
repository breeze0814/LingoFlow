use serde::{Deserialize, Serialize};
use tauri::State;

use crate::app_state::AppState;
use crate::errors::app_error::AppError;
use crate::runtime_settings_sync::{
    RuntimeSettingsDeps, RuntimeSettingsInput, RuntimeSettingsOutput,
};

#[derive(Debug, Deserialize)]
pub struct RuntimeSettingsPayload {
    pub http_api_enabled: bool,
    pub http_api_port: u16,
    pub source_lang: String,
    pub target_lang: String,
}

#[derive(Debug, Serialize)]
pub struct RuntimeSettingsResponse {
    pub http_api_enabled: bool,
    pub http_api_running: bool,
}

#[tauri::command]
pub async fn sync_runtime_settings(
    state: State<'_, AppState>,
    payload: RuntimeSettingsPayload,
) -> Result<RuntimeSettingsResponse, AppError> {
    let result = crate::runtime_settings_sync::sync_runtime_settings(
        RuntimeSettingsDeps {
            config_store: state.config_store.clone(),
            http_server_controller: state.http_server_controller.clone(),
            http_api_state: state.http_api_state.clone(),
        },
        RuntimeSettingsInput {
            http_api_enabled: payload.http_api_enabled,
            http_api_port: payload.http_api_port,
            source_lang: payload.source_lang,
            target_lang: payload.target_lang,
        },
    )
    .await?;
    Ok(map_runtime_settings_response(result))
}

fn map_runtime_settings_response(result: RuntimeSettingsOutput) -> RuntimeSettingsResponse {
    RuntimeSettingsResponse {
        http_api_enabled: result.http_api_enabled,
        http_api_running: result.http_api_running,
    }
}
