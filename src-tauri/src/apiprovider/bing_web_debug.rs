use std::env;

const PREVIEW_LIMIT: usize = 160;
const DEBUG_ENV: &str = "BING_WEB_DEBUG";

pub(super) fn normalize_timeout(timeout_ms: u64, default_timeout_ms: u64) -> u64 {
    if timeout_ms == 0 {
        default_timeout_ms
    } else {
        timeout_ms
    }
}

pub(super) fn log_bing_web(message: String) {
    if cfg!(debug_assertions) || env::var(DEBUG_ENV).ok().as_deref() == Some("1") {
        eprintln!("[bing_web] {message}");
    }
}

pub(super) fn preview(value: &str) -> String {
    build_preview(value.replace(['\r', '\n'], " "))
}

pub(super) fn preview_debug(value: &str) -> String {
    build_preview(format!("{value:?}"))
}

fn build_preview(value: String) -> String {
    let preview: String = value.chars().take(PREVIEW_LIMIT).collect();
    if value.chars().count() > PREVIEW_LIMIT {
        format!("{preview}...")
    } else {
        preview
    }
}
