const MENU_INPUT_TRANSLATE: &str = "input_translate";
const MENU_OCR_TRANSLATE: &str = "ocr_translate";
const MENU_SELECTION_TRANSLATE: &str = "selection_translate";
const MENU_SHOW_MAIN_WINDOW: &str = "show_main_window";
const MENU_HIDE_INTERFACE: &str = "hide_interface";
const MENU_OCR_RECOGNIZE: &str = "ocr_recognize";
const MENU_OPEN_SETTINGS: &str = "open_settings";
const MENU_CHECK_UPDATE: &str = "check_update";
const MENU_QUIT: &str = "quit";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct MenuEntrySpec {
    id: &'static str,
    text: &'static str,
    accelerator: Option<&'static str>,
}

fn shortcut_menu_specs() -> [MenuEntrySpec; 7] {
    [
        MenuEntrySpec {
            id: MENU_INPUT_TRANSLATE,
            text: "输入翻译",
            accelerator: Some("Option+F"),
        },
        MenuEntrySpec {
            id: MENU_OCR_TRANSLATE,
            text: "截图翻译",
            accelerator: Some("Option+S"),
        },
        MenuEntrySpec {
            id: MENU_SELECTION_TRANSLATE,
            text: "划词翻译",
            accelerator: Some("Option+D"),
        },
        MenuEntrySpec {
            id: MENU_SHOW_MAIN_WINDOW,
            text: "显示主窗口",
            accelerator: None,
        },
        MenuEntrySpec {
            id: MENU_HIDE_INTERFACE,
            text: "关闭界面",
            accelerator: Some("Option+Q"),
        },
        MenuEntrySpec {
            id: MENU_OCR_RECOGNIZE,
            text: "静默截图 OCR",
            accelerator: Some("Shift+Option+S"),
        },
        MenuEntrySpec {
            id: MENU_OPEN_SETTINGS,
            text: "设置...",
            accelerator: Some("CmdOrControl+,"),
        },
    ]
}

#[cfg(all(desktop, not(test)))]
mod runtime {
    use serde::Serialize;
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
    use tauri::{AppHandle, Emitter, Manager, Runtime};

    use super::{
        shortcut_menu_specs, MenuEntrySpec, MENU_CHECK_UPDATE, MENU_HIDE_INTERFACE,
        MENU_INPUT_TRANSLATE, MENU_OCR_RECOGNIZE, MENU_OCR_TRANSLATE, MENU_OPEN_SETTINGS,
        MENU_QUIT, MENU_SELECTION_TRANSLATE, MENU_SHOW_MAIN_WINDOW,
    };

    const TRAY_TEMPLATE_ICON: tauri::image::Image<'_> =
        tauri::include_image!("./icons/tray_icon.png");
    const TRAY_EVENT_ACTION: &str = "tray://action";

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

    fn hide_interface<R: Runtime>(app: &AppHandle<R>) {
        for label in ["main", "ocr_result", "screenshot_overlay"] {
            let Some(window) = app.get_webview_window(label) else {
                continue;
            };
            if let Err(error) = window.hide() {
                eprintln!("failed to hide window `{label}`: {error}");
            }
        }
    }

    fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, menu_id: &str) {
        match menu_id {
            MENU_INPUT_TRANSLATE => emit_action(app, MENU_INPUT_TRANSLATE),
            MENU_OCR_TRANSLATE => emit_action(app, MENU_OCR_TRANSLATE),
            MENU_SELECTION_TRANSLATE => emit_action(app, MENU_SELECTION_TRANSLATE),
            MENU_SHOW_MAIN_WINDOW => {
                show_main_window(app);
                emit_action(app, MENU_SHOW_MAIN_WINDOW);
            }
            MENU_HIDE_INTERFACE => hide_interface(app),
            MENU_OCR_RECOGNIZE => emit_action(app, MENU_OCR_RECOGNIZE),
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

    fn build_shortcut_item<R: Runtime>(
        app: &AppHandle<R>,
        spec: MenuEntrySpec,
    ) -> tauri::Result<MenuItem<R>> {
        MenuItem::with_id(app, spec.id, spec.text, true, spec.accelerator)
    }

    fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
        let specs = shortcut_menu_specs();
        let input_translate = build_shortcut_item(app, specs[0])?;
        let ocr_translate = build_shortcut_item(app, specs[1])?;
        let selection_translate = build_shortcut_item(app, specs[2])?;
        let show_main = build_shortcut_item(app, specs[3])?;
        let hide_interface = build_shortcut_item(app, specs[4])?;
        let ocr_recognize = build_shortcut_item(app, specs[5])?;
        let settings = build_shortcut_item(app, specs[6])?;
        let check_update =
            MenuItem::with_id(app, MENU_CHECK_UPDATE, "检查更新", true, None::<&str>)?;
        let help_center = MenuItem::with_id(app, "help_center", "帮助文档", false, None::<&str>)?;
        let issue_feedback =
            MenuItem::with_id(app, "help_feedback", "问题反馈", false, None::<&str>)?;
        let quit = MenuItem::with_id(app, MENU_QUIT, "退出", true, Some("CmdOrControl+Q"))?;

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
                &show_main,
                &hide_interface,
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

#[cfg(all(desktop, not(test)))]
pub use runtime::setup;

#[cfg(any(test, not(desktop)))]
pub fn setup<R: tauri::Runtime>(_app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        shortcut_menu_specs, MENU_HIDE_INTERFACE, MENU_INPUT_TRANSLATE, MENU_OCR_RECOGNIZE,
        MENU_OCR_TRANSLATE,
    };

    #[test]
    fn tray_shortcut_menu_matches_current_shortcuts() {
        let specs = shortcut_menu_specs();

        assert_eq!(specs[0].id, MENU_INPUT_TRANSLATE);
        assert_eq!(specs[0].accelerator, Some("Option+F"));
        assert_eq!(specs[1].id, MENU_OCR_TRANSLATE);
        assert_eq!(specs[1].accelerator, Some("Option+S"));
        assert_eq!(specs[4].id, MENU_HIDE_INTERFACE);
        assert_eq!(specs[4].text, "关闭界面");
        assert_eq!(specs[4].accelerator, Some("Option+Q"));
        assert_eq!(specs[5].id, MENU_OCR_RECOGNIZE);
        assert_eq!(specs[5].accelerator, Some("Shift+Option+S"));
    }

    #[test]
    fn tray_menu_does_not_include_removed_actions() {
        let specs = shortcut_menu_specs();
        let ids = specs.iter().map(|spec| spec.id).collect::<Vec<_>>();

        assert!(!ids.contains(&"clipboard_translate"));
        assert!(!ids.contains(&"polish_replace"));
        assert!(!ids.contains(&"translate_replace"));
    }
}
