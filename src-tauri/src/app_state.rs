use std::sync::Arc;

use crate::errors::app_error::AppError;
use crate::http_api::controller::HttpServerController;
use crate::orchestrator::service::Orchestrator;
use crate::providers::registry::ProviderRegistry;
use crate::storage::config_store::ConfigStore;
use crate::storage::keychain_store::KeychainStore;

pub struct AppState {
    pub orchestrator: Arc<Orchestrator>,
    pub config_store: Arc<ConfigStore>,
    pub http_server_controller: Arc<HttpServerController>,
    #[cfg(target_os = "windows")]
    pub providers: Arc<ProviderRegistry>,
    pub _keychain_store: Arc<KeychainStore>,
}

impl AppState {
    pub fn new() -> Result<Self, AppError> {
        let config_store = Arc::new(ConfigStore::new_default());
        let http_server_controller = Arc::new(HttpServerController::new());
        let keychain_store = Arc::new(KeychainStore::new());
        let providers = Arc::new(ProviderRegistry::new());
        let orchestrator = Arc::new(Orchestrator::new(config_store.clone(), providers.clone()));
        Ok(Self {
            orchestrator,
            config_store,
            http_server_controller,
            #[cfg(target_os = "windows")]
            providers,
            _keychain_store: keychain_store,
        })
    }
}
