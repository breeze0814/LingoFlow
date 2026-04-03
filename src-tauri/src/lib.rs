mod apiprovider;
mod app_state;
mod commands;
mod errors;
mod http_api;
mod orchestrator;
mod platform;
mod providers;
mod shortcuts;
mod storage;
mod tray;

use app_state::AppState;
use http_api::server::start_http_server;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            let state = AppState::new()?;
            if state.config_store.get().http_api.enabled {
                let opts = state.config_store.http_server_options();
                let orchestrator = state.orchestrator.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(err) = start_http_server(opts, orchestrator).await {
                        eprintln!("http server exited with error: {}", err.message);
                    }
                });
            }
            app.manage(state);
            shortcuts::setup(&app.handle())?;
            tray::setup(&app.handle())?;
            if let Some(main_window) = app.get_webview_window("main") {
                main_window.hide()?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::debug::debug_print,
            commands::translation::selection_translate,
            commands::translation::input_translate,
            commands::ocr::ocr_recognize,
            commands::ocr::ocr_translate
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
