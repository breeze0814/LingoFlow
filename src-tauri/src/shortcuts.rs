#[cfg(desktop)]
mod desktop {
    use serde::Serialize;
    use tauri::{AppHandle, Emitter, Manager, Runtime};
    use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

    const TRAY_EVENT_ACTION: &str = "tray://action";

    const ACTION_INPUT_TRANSLATE: &str = "input_translate";
    const ACTION_OCR_TRANSLATE: &str = "ocr_translate";
    const ACTION_SELECTION_TRANSLATE: &str = "selection_translate";
    const ACTION_SHOW_MAIN_WINDOW: &str = "show_main_window";
    const ACTION_OCR_RECOGNIZE: &str = "ocr_recognize";
    const ACTION_OPEN_SETTINGS: &str = "open_settings";

    #[derive(Clone, Serialize)]
    struct TrayActionPayload {
        action: &'static str,
    }

    #[cfg(target_os = "macos")]
    fn command_or_control() -> Modifiers {
        Modifiers::SUPER
    }

    #[cfg(not(target_os = "macos"))]
    fn command_or_control() -> Modifiers {
        Modifiers::CONTROL
    }

    fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
        let Some(window) = app.get_webview_window("main") else {
            return;
        };
        if let Err(error) = window.show() {
            eprintln!("failed to show main window: {error}");
        }
        if let Err(error) = window.unminimize() {
            eprintln!("failed to unminimize main window: {error}");
        }
        if let Err(error) = window.set_focus() {
            eprintln!("failed to focus main window: {error}");
        }
    }

    fn emit_action<R: Runtime>(app: &AppHandle<R>, action: &'static str) {
        if let Err(error) = app.emit(TRAY_EVENT_ACTION, TrayActionPayload { action }) {
            eprintln!("failed to emit shortcut action `{action}`: {error}");
        }
    }

    fn trigger_action<R: Runtime>(app: &AppHandle<R>, action: &'static str, show_main: bool) {
        if show_main {
            show_main_window(app);
        }
        emit_action(app, action);
    }

    fn handle_pressed_shortcut<R: Runtime>(app: &AppHandle<R>, shortcut: &Shortcut) {
        if shortcut.matches(Modifiers::SHIFT | Modifiers::ALT, Code::KeyS) {
            trigger_action(app, ACTION_OCR_RECOGNIZE, false);
            return;
        }
        if shortcut.matches(Modifiers::ALT, Code::KeyA) {
            trigger_action(app, ACTION_INPUT_TRANSLATE, true);
            return;
        }
        if shortcut.matches(Modifiers::ALT, Code::KeyS) {
            trigger_action(app, ACTION_OCR_TRANSLATE, false);
            return;
        }
        if shortcut.matches(Modifiers::ALT, Code::KeyD) {
            trigger_action(app, ACTION_SELECTION_TRANSLATE, true);
            return;
        }
        if shortcut.matches(Modifiers::ALT, Code::KeyF) {
            trigger_action(app, ACTION_SHOW_MAIN_WINDOW, true);
            return;
        }
        if shortcut.matches(command_or_control(), Code::Comma) {
            trigger_action(app, ACTION_OPEN_SETTINGS, true);
        }
    }

    fn default_shortcuts() -> Vec<Shortcut> {
        vec![
            Shortcut::new(Some(Modifiers::ALT), Code::KeyA),
            Shortcut::new(Some(Modifiers::ALT), Code::KeyS),
            Shortcut::new(Some(Modifiers::ALT), Code::KeyD),
            Shortcut::new(Some(Modifiers::ALT), Code::KeyF),
            Shortcut::new(Some(Modifiers::SHIFT | Modifiers::ALT), Code::KeyS),
            Shortcut::new(Some(command_or_control()), Code::Comma),
        ]
    }

    pub fn setup<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
        let builder = tauri_plugin_global_shortcut::Builder::new()
            .with_shortcuts(default_shortcuts())
            .map_err(|error| std::io::Error::other(error.to_string()))?;
        app.plugin(
            builder
                .with_handler(|app, shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        handle_pressed_shortcut(app, shortcut);
                    }
                })
                .build(),
        )?;
        Ok(())
    }
}

#[cfg(desktop)]
pub use desktop::setup;

#[cfg(not(desktop))]
pub fn setup<R: tauri::Runtime>(_app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    Ok(())
}
