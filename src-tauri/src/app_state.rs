use std::sync::Arc;

use crate::errors::app_error::AppError;
use crate::http_api::controller::HttpServerController;
use crate::orchestrator::service::Orchestrator;
use crate::providers::registry::ProviderRegistry;
use crate::storage::config_store::ConfigStore;
use crate::storage::keychain_store::KeychainStore;
use crate::storage::settings_store::{extract_runtime_settings, SettingsStore};
use tauri::Manager;

pub struct AppState {
    pub orchestrator: Arc<Orchestrator>,
    pub config_store: Arc<ConfigStore>,
    pub http_server_controller: Arc<HttpServerController>,
    #[cfg(target_os = "windows")]
    pub providers: Arc<ProviderRegistry>,
    pub keychain_store: Arc<KeychainStore>,
    pub settings_store: Arc<SettingsStore>,
}

impl AppState {
    pub fn new<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<Self, AppError> {
        let config_store = Arc::new(ConfigStore::new_default());
        let http_server_controller = Arc::new(HttpServerController::new());
        let keychain_store = Arc::new(KeychainStore::new(app.config().identifier.clone()));
        let app_config_dir = app.path().app_config_dir().map_err(|error| {
            AppError::new(
                crate::errors::error_code::ErrorCode::InternalError,
                format!("Failed to resolve app config directory: {error}"),
                false,
            )
        })?;
        let settings_store = Arc::new(SettingsStore::new(app_config_dir));
        if let Some(settings) = settings_store.load()? {
            if let Some(runtime_settings) = extract_runtime_settings(&settings)? {
                config_store.set_app_languages(
                    runtime_settings.primary_language,
                    runtime_settings.secondary_language,
                );
                config_store.set_http_api_enabled(runtime_settings.http_api_enabled);
            }
        }
        let providers = Arc::new(ProviderRegistry::new());
        let orchestrator = Arc::new(Orchestrator::new(config_store.clone(), providers.clone()));
        Ok(Self {
            orchestrator,
            config_store,
            http_server_controller,
            #[cfg(target_os = "windows")]
            providers,
            keychain_store,
            settings_store,
        })
    }
}
