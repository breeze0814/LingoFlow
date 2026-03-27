use std::sync::Arc;

use axum::Router;
use tokio::net::TcpListener;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::http_api::routes::build_router;
use crate::orchestrator::service::Orchestrator;
use crate::storage::config_store::HttpServerOptions;

pub async fn start_http_server(
    opts: HttpServerOptions,
    orchestrator: Arc<Orchestrator>,
) -> Result<(), AppError> {
    let app: Router = build_router(orchestrator);
    let bind = format!("{}:{}", opts.host, opts.port);
    let listener = TcpListener::bind(bind).await.map_err(|err| {
        AppError::new(
            ErrorCode::HttpPortInUse,
            format!("Failed to bind localhost API: {err}"),
            false,
        )
    })?;
    axum::serve(listener, app).await.map_err(|err| {
        AppError::new(
            ErrorCode::InternalError,
            format!("HTTP server exited unexpectedly: {err}"),
            true,
        )
    })?;
    Ok(())
}
