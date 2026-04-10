use std::sync::Arc;

use crate::errors::app_error::AppError;
use crate::http_api::runtime_provider_settings::RuntimeProviderSettings;
use crate::http_api::ui_dispatcher::SharedHttpUiDispatcher;
use crate::orchestrator::service::Orchestrator;
use crate::storage::keychain_store::KeychainStore;
use crate::storage::settings_store::SettingsStore;

pub struct HttpApiState {
    pub orchestrator: Arc<Orchestrator>,
    pub ui_dispatcher: SharedHttpUiDispatcher,
    settings_store: Arc<SettingsStore>,
    keychain_store: Arc<KeychainStore>,
}

impl HttpApiState {
    pub fn new(
        orchestrator: Arc<Orchestrator>,
        ui_dispatcher: SharedHttpUiDispatcher,
        settings_store: Arc<SettingsStore>,
        keychain_store: Arc<KeychainStore>,
    ) -> Self {
        Self {
            orchestrator,
            ui_dispatcher,
            settings_store,
            keychain_store,
        }
    }

    pub fn runtime_provider_settings(&self) -> Result<RuntimeProviderSettings, AppError> {
        RuntimeProviderSettings::load(&self.settings_store, &self.keychain_store)
    }
}
