use std::mem;
use std::sync::Arc;

use tokio::sync::Mutex;
use tokio::task::JoinHandle;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::http_api::server::{bind_http_listener, serve_http_listener};
use crate::orchestrator::service::Orchestrator;
use crate::storage::config_store::HttpServerOptions;

enum HttpServerState {
    Stopped,
    Running {
        handle: JoinHandle<Result<(), AppError>>,
    },
}

pub struct HttpServerController {
    state: Mutex<HttpServerState>,
}

impl HttpServerController {
    pub fn new() -> Self {
        Self {
            state: Mutex::new(HttpServerState::Stopped),
        }
    }

    pub async fn start(
        &self,
        opts: HttpServerOptions,
        orchestrator: Arc<Orchestrator>,
    ) -> Result<(), AppError> {
        let mut state = self.state.lock().await;
        Self::reconcile(&mut state).await?;
        if matches!(*state, HttpServerState::Running { .. }) {
            return Ok(());
        }

        let listener = bind_http_listener(&opts).await?;
        let handle = tokio::spawn(async move { serve_http_listener(listener, orchestrator).await });
        *state = HttpServerState::Running { handle };
        Ok(())
    }

    pub async fn stop(&self) -> Result<(), AppError> {
        let mut state = self.state.lock().await;
        let previous = mem::replace(&mut *state, HttpServerState::Stopped);
        if let HttpServerState::Running { handle } = previous {
            handle.abort();
            Self::consume_handle(handle).await?;
        }
        Ok(())
    }

    pub async fn is_running(&self) -> Result<bool, AppError> {
        let mut state = self.state.lock().await;
        Self::reconcile(&mut state).await?;
        Ok(matches!(*state, HttpServerState::Running { .. }))
    }

    async fn reconcile(state: &mut HttpServerState) -> Result<(), AppError> {
        let finished = match state {
            HttpServerState::Running { handle } => handle.is_finished(),
            HttpServerState::Stopped => false,
        };
        if !finished {
            return Ok(());
        }

        let previous = mem::replace(state, HttpServerState::Stopped);
        if let HttpServerState::Running { handle } = previous {
            Self::consume_handle(handle).await?;
        }
        Ok(())
    }

    async fn consume_handle(handle: JoinHandle<Result<(), AppError>>) -> Result<(), AppError> {
        match handle.await {
            Ok(Ok(())) => Ok(()),
            Ok(Err(error)) => Err(error),
            Err(error) if error.is_cancelled() => Ok(()),
            Err(error) => Err(AppError::new(
                ErrorCode::InternalError,
                format!("HTTP server task failed: {error}"),
                true,
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::HttpServerController;
    use std::net::TcpListener;
    use std::sync::Arc;

    use reqwest::StatusCode;
    use serde_json::json;

    use crate::orchestrator::service::Orchestrator;
    use crate::providers::registry::ProviderRegistry;
    use crate::storage::config_store::{ConfigStore, HttpServerOptions};

    fn free_server_options() -> HttpServerOptions {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind free port");
        let port = listener.local_addr().expect("read local addr").port();
        drop(listener);
        HttpServerOptions {
            host: "127.0.0.1".to_string(),
            port,
        }
    }

    fn make_orchestrator() -> Arc<Orchestrator> {
        let config_store = Arc::new(ConfigStore::new_default());
        let providers = Arc::new(ProviderRegistry::new());
        Arc::new(Orchestrator::new(config_store, providers))
    }

    async fn start_server() -> (HttpServerController, String) {
        let controller = HttpServerController::new();
        let opts = free_server_options();
        let base_url = format!("http://{}:{}", opts.host, opts.port);
        controller
            .start(opts, make_orchestrator())
            .await
            .expect("start http server");
        (controller, base_url)
    }

    #[tokio::test]
    async fn starts_and_stops_http_server() {
        let controller = HttpServerController::new();
        let opts = free_server_options();
        let bind_addr = format!("{}:{}", opts.host, opts.port);

        controller
            .start(opts.clone(), make_orchestrator())
            .await
            .expect("start http server");
        assert!(controller.is_running().await.expect("read running state"));

        controller.stop().await.expect("stop http server");
        assert!(!controller.is_running().await.expect("read stopped state"));

        TcpListener::bind(bind_addr).expect("port released after stop");
    }

    #[tokio::test]
    async fn start_is_idempotent() {
        let controller = HttpServerController::new();
        let opts = free_server_options();

        controller
            .start(opts.clone(), make_orchestrator())
            .await
            .expect("first start");
        controller
            .start(opts, make_orchestrator())
            .await
            .expect("second start");

        assert!(controller.is_running().await.expect("read running state"));
        controller.stop().await.expect("stop http server");
    }

    #[tokio::test]
    async fn rejects_non_loopback_host() {
        let controller = HttpServerController::new();
        let opts = HttpServerOptions {
            host: "0.0.0.0".to_string(),
            port: free_server_options().port,
        };

        let error = controller
            .start(opts, make_orchestrator())
            .await
            .expect_err("non-loopback host should be rejected");

        assert!(matches!(error.code, crate::errors::error_code::ErrorCode::HttpInvalidRequest));
    }

    #[tokio::test]
    async fn translate_endpoint_rejects_blank_input() {
        let (controller, base_url) = start_server().await;
        let client = reqwest::Client::new();

        let response = client
            .post(format!("{base_url}/translate"))
            .json(&json!({
                "text": "   ",
            }))
            .send()
            .await
            .expect("send blank translate request");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        controller.stop().await.expect("stop http server");
    }

    #[tokio::test]
    async fn translate_endpoint_rejects_oversized_input() {
        let (controller, base_url) = start_server().await;
        let client = reqwest::Client::new();

        let response = client
            .post(format!("{base_url}/translate"))
            .json(&json!({
                "text": "x".repeat(20_001),
                "provider_id": "unsupported_provider",
            }))
            .send()
            .await
            .expect("send oversized translate request");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        controller.stop().await.expect("stop http server");
    }
}
