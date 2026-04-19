use std::sync::Arc;

use crate::errors::app_error::AppError;
use crate::http_api::controller::HttpServerController;
use crate::http_api::server::bind_http_listener;
use crate::http_api::state::HttpApiState;
use crate::storage::config_store::{ConfigStore, HttpServerOptions};

#[derive(Debug, Clone)]
pub struct RuntimeSettingsInput {
    pub http_api_enabled: bool,
    pub http_api_port: u16,
    pub source_lang: String,
    pub target_lang: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeSettingsOutput {
    pub http_api_enabled: bool,
    pub http_api_running: bool,
}

#[derive(Clone)]
pub struct RuntimeSettingsDeps {
    pub config_store: Arc<ConfigStore>,
    pub http_server_controller: Arc<HttpServerController>,
    pub http_api_state: Arc<HttpApiState>,
}

pub async fn sync_runtime_settings(
    deps: RuntimeSettingsDeps,
    payload: RuntimeSettingsInput,
) -> Result<RuntimeSettingsOutput, AppError> {
    let config_store = deps.config_store;
    let http_server_controller = deps.http_server_controller;
    let http_api_state = deps.http_api_state;
    let current = config_store.get();
    let next_opts = HttpServerOptions {
        host: current.http_api.host,
        port: payload.http_api_port,
    };
    let is_running = http_server_controller.is_running().await?;
    let should_restart = payload.http_api_enabled
        && (!is_running
            || !current.http_api.enabled
            || current.http_api.port != payload.http_api_port);

    let listener = if should_restart {
        Some(bind_http_listener(&next_opts).await?)
    } else {
        None
    };

    if payload.http_api_enabled {
        if let Some(listener) = listener {
            http_server_controller.stop().await?;
            http_server_controller
                .start_bound(listener, http_api_state)
                .await?;
        }
    } else if is_running {
        http_server_controller.stop().await?;
    }

    config_store.set_app_languages(payload.source_lang, payload.target_lang);
    config_store.set_http_api_port(payload.http_api_port);
    config_store.set_http_api_enabled(payload.http_api_enabled);

    Ok(RuntimeSettingsOutput {
        http_api_enabled: config_store.http_api_enabled(),
        http_api_running: http_server_controller.is_running().await?,
    })
}

#[cfg(test)]
mod tests {
    use super::{sync_runtime_settings, RuntimeSettingsDeps, RuntimeSettingsInput};
    use std::net::TcpListener;
    use std::sync::Arc;

    use crate::http_api::controller::HttpServerController;
    use crate::http_api::state::HttpApiState;
    use crate::http_api::ui_dispatcher::NoopHttpUiDispatcher;
    use crate::orchestrator::service::Orchestrator;
    use crate::providers::registry::ProviderRegistry;
    use crate::storage::config_store::{ConfigStore, HttpServerOptions};
    use crate::storage::keychain_store::KeychainStore;
    use crate::storage::settings_store::SettingsStore;

    fn free_server_options() -> HttpServerOptions {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind free port");
        let port = listener.local_addr().expect("read local addr").port();
        drop(listener);
        HttpServerOptions {
            host: "127.0.0.1".to_string(),
            port,
        }
    }

    fn make_http_api_state() -> Arc<HttpApiState> {
        let config_store = Arc::new(ConfigStore::new_default());
        let providers = Arc::new(ProviderRegistry::new());
        let orchestrator = Arc::new(Orchestrator::new(config_store, providers));
        let settings_store = Arc::new(SettingsStore::new(std::env::temp_dir().join(format!(
            "lingoflow-runtime-settings-test-{}",
            uuid::Uuid::new_v4()
        ))));
        let keychain_store = Arc::new(KeychainStore::new("test"));
        Arc::new(HttpApiState::new(
            crate::http_api::state::HttpApiStateConfig {
                orchestrator,
                ui_dispatcher: Arc::new(NoopHttpUiDispatcher),
                settings_store,
                keychain_store,
            },
        ))
    }

    #[tokio::test]
    async fn keeps_existing_server_running_when_new_port_bind_fails() {
        let config_store = Arc::new(ConfigStore::new_default());
        let controller = Arc::new(HttpServerController::new());
        let http_api_state = make_http_api_state();
        let running_opts = free_server_options();
        controller
            .start(running_opts.clone(), http_api_state.clone())
            .await
            .expect("start existing http server");
        config_store.set_http_api_enabled(true);
        config_store.set_http_api_port(running_opts.port);

        let occupied = TcpListener::bind("127.0.0.1:0").expect("occupy replacement port");
        let blocked_port = occupied.local_addr().expect("occupied local addr").port();

        let result = sync_runtime_settings(
            RuntimeSettingsDeps {
                config_store: config_store.clone(),
                http_server_controller: controller.clone(),
                http_api_state,
            },
            RuntimeSettingsInput {
                http_api_enabled: true,
                http_api_port: blocked_port,
                source_lang: "en".to_string(),
                target_lang: "ja".to_string(),
            },
        )
        .await;

        assert!(result.is_err(), "port bind failure should bubble up");
        assert!(
            controller
                .is_running()
                .await
                .expect("read controller running state"),
            "existing server should remain running after failed switch"
        );
        let current = config_store.get();
        assert_eq!(current.http_api.port, running_opts.port);
        assert_eq!(current.app.source_lang, "auto");
        assert_eq!(current.app.target_lang, "zh-CN");

        controller.stop().await.expect("stop existing http server");
    }
}
