mod apiprovider;
#[cfg(not(test))]
mod app_state;
#[cfg(not(test))]
mod commands;
mod errors;
mod http_api;
mod orchestrator;
mod platform;
mod providers;
mod shortcuts;
mod storage;
mod tray;
mod window_lifecycle;

#[cfg(not(test))]
use app_state::AppState;
#[cfg(not(test))]
use tauri::Manager;
#[cfg(not(test))]
use window_lifecycle::{close_request_action, CloseRequestAction};

#[cfg(target_os = "windows")]
pub use platform::windows_capture::{build_clipboard_wait_script, build_region_capture_script};

#[cfg(not(test))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .on_window_event(|window, event| {
            if close_request_action(
                window.label(),
                matches!(event, tauri::WindowEvent::CloseRequested { .. }),
            ) == CloseRequestAction::HideToTray
            {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                }
                if let Err(error) = window.hide() {
                    eprintln!("failed to hide main window on close request: {error}");
                }
            }
        })
        .setup(|app| {
            let state = AppState::new()?;
            #[cfg(target_os = "windows")]
            state.providers.attach_app_handle(app.handle().clone());
            if state.config_store.get().http_api.enabled {
                let opts = state.config_store.http_server_options();
                let orchestrator = state.orchestrator.clone();
                let controller = state.http_server_controller.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(err) = controller.start(opts, orchestrator).await {
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
        });

    #[cfg(test)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        commands::debug::debug_print,
        commands::shortcuts::sync_global_shortcuts,
        commands::runtime_settings::sync_runtime_settings,
        commands::translation::selection_translate,
        commands::translation::read_selection_text,
        commands::translation::input_translate,
        commands::ocr::ocr_recognize,
        commands::ocr::ocr_translate,
        commands::ocr::ocr_recognize_region,
        commands::ocr::ocr_translate_region,
        commands::window_display::set_capture_excluded
    ]);

    #[cfg(all(not(test), target_os = "windows"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        commands::debug::debug_print,
        commands::shortcuts::sync_global_shortcuts,
        commands::runtime_settings::sync_runtime_settings,
        commands::translation::selection_translate,
        commands::translation::read_selection_text,
        commands::translation::input_translate,
        commands::ocr::ocr_recognize,
        commands::ocr::ocr_translate,
        commands::ocr::ocr_recognize_region,
        commands::ocr::ocr_translate_region,
        commands::tesseract_ocr::resolve_tesseract_ocr,
        commands::window_display::set_capture_excluded
    ]);

    #[cfg(all(not(test), not(target_os = "windows")))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        commands::debug::debug_print,
        commands::shortcuts::sync_global_shortcuts,
        commands::runtime_settings::sync_runtime_settings,
        commands::translation::selection_translate,
        commands::translation::read_selection_text,
        commands::translation::input_translate,
        commands::ocr::ocr_recognize,
        commands::ocr::ocr_translate,
        commands::ocr::ocr_recognize_region,
        commands::ocr::ocr_translate_region,
        commands::window_display::set_capture_excluded
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
pub fn run() {
    panic!("run() is unavailable in unit tests");
}
