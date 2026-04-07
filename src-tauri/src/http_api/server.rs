use std::sync::Arc;

use axum::Router;
use tokio::net::TcpListener;

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;
use crate::http_api::routes::build_router;
use crate::orchestrator::service::Orchestrator;
use crate::storage::config_store::HttpServerOptions;

pub async fn bind_http_listener(opts: &HttpServerOptions) -> Result<TcpListener, AppError> {
    ensure_loopback_host(&opts.host)?;
    let bind = format_bind_address(&opts.host, opts.port);
    TcpListener::bind(bind).await.map_err(|err| {
        AppError::new(
            ErrorCode::HttpPortInUse,
            format!("Failed to bind localhost API: {err}"),
            false,
        )
    })
}

fn ensure_loopback_host(host: &str) -> Result<(), AppError> {
    if matches!(host, "127.0.0.1" | "localhost" | "::1") {
        return Ok(());
    }
    Err(AppError::new(
        ErrorCode::HttpInvalidRequest,
        format!("HTTP API host must stay on loopback, got `{host}`"),
        false,
    ))
}

fn format_bind_address(host: &str, port: u16) -> String {
    if host.contains(':') {
        return format!("[{host}]:{port}");
    }
    format!("{host}:{port}")
}

pub async fn serve_http_listener(
    listener: TcpListener,
    orchestrator: Arc<Orchestrator>,
) -> Result<(), AppError> {
    let app: Router = build_router(orchestrator);
    axum::serve(listener, app).await.map_err(|err| {
        AppError::new(
            ErrorCode::InternalError,
            format!("HTTP server exited unexpectedly: {err}"),
            true,
        )
    })?;
    Ok(())
}
