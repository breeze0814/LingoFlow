use std::sync::Arc;

use crate::errors::app_error::AppError;
use crate::http_api::runtime_provider_settings::RuntimeProviderSettings;
use crate::http_api::ui_dispatcher::SharedHttpUiDispatcher;
use crate::orchestrator::service::Orchestrator;
use crate::storage::keychain_store::KeychainStore;
use crate::storage::settings_store::SettingsStore;

pub struct HttpApiStateConfig {
    pub orchestrator: Arc<Orchestrator>,
    pub ui_dispatcher: SharedHttpUiDispatcher,
    pub settings_store: Arc<SettingsStore>,
    pub keychain_store: Arc<KeychainStore>,
}

pub struct HttpApiState {
    pub orchestrator: Arc<Orchestrator>,
    pub ui_dispatcher: SharedHttpUiDispatcher,
    settings_store: Arc<SettingsStore>,
    keychain_store: Arc<KeychainStore>,
}

impl HttpApiState {
    pub fn new(config: HttpApiStateConfig) -> Self {
        Self {
            orchestrator: config.orchestrator,
            ui_dispatcher: config.ui_dispatcher,
            settings_store: config.settings_store,
            keychain_store: config.keychain_store,
        }
    }

    pub fn runtime_provider_settings(&self) -> Result<RuntimeProviderSettings, AppError> {
        RuntimeProviderSettings::load(&self.settings_store, &self.keychain_store)
    }
}
