use serde::{Deserialize, Serialize};
use tauri::State;

use crate::app_state::AppState;
use crate::errors::app_error::AppError;

#[derive(Debug, Deserialize)]
pub struct RuntimeSettingsPayload {
    pub http_api_enabled: bool,
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
    state
        .config_store
        .set_app_languages(payload.source_lang, payload.target_lang);
    if payload.http_api_enabled {
        let opts = state.config_store.http_server_options();
        state
            .http_server_controller
            .start(opts, state.orchestrator.clone())
            .await?;
        state.config_store.set_http_api_enabled(true);
    } else {
        state.http_server_controller.stop().await?;
        state.config_store.set_http_api_enabled(false);
    }

    Ok(RuntimeSettingsResponse {
        http_api_enabled: state.config_store.http_api_enabled(),
        http_api_running: state.http_server_controller.is_running().await?,
    })
}
