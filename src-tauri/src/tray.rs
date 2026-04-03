#[cfg(desktop)]
mod desktop {
    use serde::Serialize;
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
    use tauri::{AppHandle, Emitter, Manager, Runtime};

    const TRAY_TEMPLATE_ICON: tauri::image::Image<'_> =
        tauri::include_image!("./icons/tray_icon.png");

    const TRAY_EVENT_ACTION: &str = "tray://action";

    const MENU_INPUT_TRANSLATE: &str = "input_translate";
    const MENU_OCR_TRANSLATE: &str = "ocr_translate";
    const MENU_SELECTION_TRANSLATE: &str = "selection_translate";
    const MENU_CLIPBOARD_TRANSLATE: &str = "clipboard_translate";
    const MENU_SHOW_MAIN_WINDOW: &str = "show_main_window";
    const MENU_OCR_RECOGNIZE: &str = "ocr_recognize";
    const MENU_OPEN_SETTINGS: &str = "open_settings";
    const MENU_CHECK_UPDATE: &str = "check_update";
    const MENU_QUIT: &str = "quit";

    #[derive(Clone, Serialize)]
    struct TrayActionPayload {
        action: &'static str,
    }

    fn emit_action<R: Runtime>(app: &AppHandle<R>, action: &'static str) {
        if let Err(error) = app.emit(TRAY_EVENT_ACTION, TrayActionPayload { action }) {
            eprintln!("failed to emit tray action `{action}`: {error}");
        }
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

    fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, menu_id: &str) {
        match menu_id {
            MENU_INPUT_TRANSLATE => {
                show_main_window(app);
                emit_action(app, MENU_INPUT_TRANSLATE);
            }
            MENU_OCR_TRANSLATE => {
                emit_action(app, MENU_OCR_TRANSLATE);
            }
            MENU_SELECTION_TRANSLATE => {
                show_main_window(app);
                emit_action(app, MENU_SELECTION_TRANSLATE);
            }
            MENU_CLIPBOARD_TRANSLATE => {
                show_main_window(app);
                emit_action(app, MENU_CLIPBOARD_TRANSLATE);
            }
            MENU_SHOW_MAIN_WINDOW => {
                show_main_window(app);
                emit_action(app, MENU_SHOW_MAIN_WINDOW);
            }
            MENU_OCR_RECOGNIZE => {
                emit_action(app, MENU_OCR_RECOGNIZE);
            }
            MENU_OPEN_SETTINGS => {
                show_main_window(app);
                emit_action(app, MENU_OPEN_SETTINGS);
            }
            MENU_CHECK_UPDATE => {
                show_main_window(app);
                emit_action(app, MENU_CHECK_UPDATE);
            }
            MENU_QUIT => app.exit(0),
            _ => {}
        }
    }

    fn handle_tray_click<R: Runtime>(app: &AppHandle<R>, event: TrayIconEvent) {
        if let TrayIconEvent::Click {
            button,
            button_state,
            ..
        } = event
        {
            if button == MouseButton::Left && button_state == MouseButtonState::Up {
                show_main_window(app);
                emit_action(app, MENU_SHOW_MAIN_WINDOW);
            }
        }
    }

    fn menu_item<R: Runtime>(
        app: &AppHandle<R>,
        id: &str,
        text: &str,
        enabled: bool,
        accelerator: Option<&str>,
    ) -> tauri::Result<MenuItem<R>> {
        MenuItem::with_id(app, id, text, enabled, accelerator)
    }

    fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
        let input_translate = menu_item(
            app,
            MENU_INPUT_TRANSLATE,
            "输入翻译",
            true,
            Some("Option+A"),
        )?;
        let ocr_translate = menu_item(app, MENU_OCR_TRANSLATE, "截图翻译", true, Some("Option+S"))?;
        let selection_translate = menu_item(
            app,
            MENU_SELECTION_TRANSLATE,
            "划词翻译",
            true,
            Some("Option+D"),
        )?;
        let clipboard_translate =
            menu_item(app, MENU_CLIPBOARD_TRANSLATE, "剪贴板翻译", true, None)?;
        let polish_replace = menu_item(app, "polish_replace", "润色并替换", false, None)?;
        let translate_replace = menu_item(app, "translate_replace", "翻译并替换", false, None)?;
        let show_main = menu_item(
            app,
            MENU_SHOW_MAIN_WINDOW,
            "显示迷你窗口",
            true,
            Some("Option+F"),
        )?;
        let ocr_recognize = menu_item(
            app,
            MENU_OCR_RECOGNIZE,
            "静默截图 OCR",
            true,
            Some("Shift+Option+S"),
        )?;
        let settings = menu_item(
            app,
            MENU_OPEN_SETTINGS,
            "设置...",
            true,
            Some("CmdOrControl+,"),
        )?;
        let check_update = menu_item(app, MENU_CHECK_UPDATE, "检查更新", true, None)?;
        let help_center = menu_item(app, "help_center", "帮助文档", false, None)?;
        let issue_feedback = menu_item(app, "help_feedback", "问题反馈", false, None)?;
        let quit = menu_item(app, MENU_QUIT, "退出", true, Some("CmdOrControl+Q"))?;

        let help_menu = Submenu::with_items(app, "帮助", true, &[&help_center, &issue_feedback])?;
        let divider_top = PredefinedMenuItem::separator(app)?;
        let divider_mid = PredefinedMenuItem::separator(app)?;
        let divider_bottom = PredefinedMenuItem::separator(app)?;

        Menu::with_items(
            app,
            &[
                &input_translate,
                &ocr_translate,
                &selection_translate,
                &clipboard_translate,
                &polish_replace,
                &translate_replace,
                &show_main,
                &divider_top,
                &ocr_recognize,
                &divider_mid,
                &settings,
                &check_update,
                &help_menu,
                &divider_bottom,
                &quit,
            ],
        )
    }

    pub fn setup<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
        let tray_menu = build_menu(app)?;

        TrayIconBuilder::with_id("main-tray")
            .menu(&tray_menu)
            .show_menu_on_left_click(false)
            .icon(TRAY_TEMPLATE_ICON)
            .icon_as_template(true)
            .tooltip("LingoFlow")
            .on_menu_event(|app, event| handle_menu_event(app, event.id().as_ref()))
            .on_tray_icon_event(|tray, event| handle_tray_click(tray.app_handle(), event))
            .build(app)?;

        Ok(())
    }
}

#[cfg(desktop)]
pub use desktop::setup;

#[cfg(not(desktop))]
pub fn setup<R: tauri::Runtime>(_app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    Ok(())
}
