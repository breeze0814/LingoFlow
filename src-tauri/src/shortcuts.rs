use serde::Deserialize;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutConfig {
    pub input_translate: String,
    pub ocr_translate: String,
    pub hide_interface: String,
    pub selection_translate: String,
    pub ocr_recognize: String,
    pub open_settings: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum ShortcutAction {
    InputTranslate,
    OcrTranslate,
    HideInterface,
    SelectionTranslate,
    OcrRecognize,
    OpenSettings,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ShortcutBinding {
    action: ShortcutAction,
    shortcut: String,
}

impl ShortcutConfig {
    fn defaults() -> Self {
        Self {
            input_translate: "Option + F".to_string(),
            ocr_translate: "Option + S".to_string(),
            hide_interface: "Option + Q".to_string(),
            selection_translate: "Option + D".to_string(),
            ocr_recognize: "Shift + Option + S".to_string(),
            open_settings: "Cmd/Ctrl + ,".to_string(),
        }
    }
}

impl ShortcutAction {
    #[cfg(not(test))]
    fn tray_action(self) -> &'static str {
        match self {
            Self::InputTranslate => "input_translate",
            Self::OcrTranslate => "ocr_translate",
            Self::HideInterface => "",
            Self::SelectionTranslate => "selection_translate",
            Self::OcrRecognize => "ocr_recognize",
            Self::OpenSettings => "open_settings",
        }
    }

    fn requires_window_display(self) -> bool {
        matches!(self, Self::OpenSettings)
    }
}

fn normalize_modifier_token(token: &str) -> Option<&'static str> {
    match token.to_lowercase().as_str() {
        "cmd" | "command" | "meta" => Some("Cmd"),
        "ctrl" | "control" => Some("Ctrl"),
        "cmd/ctrl" | "cmdorctrl" | "commandorcontrol" => Some("CmdOrControl"),
        "option" | "opt" => Some("Option"),
        "alt" => Some("Alt"),
        "shift" => Some("Shift"),
        _ => None,
    }
}

fn normalize_key_token(token: &str) -> String {
    match token.to_lowercase().as_str() {
        "esc" | "escape" => "Escape".to_string(),
        "space" => "Space".to_string(),
        "enter" => "Enter".to_string(),
        "tab" => "Tab".to_string(),
        "up" => "ArrowUp".to_string(),
        "down" => "ArrowDown".to_string(),
        "left" => "ArrowLeft".to_string(),
        "right" => "ArrowRight".to_string(),
        _ if token.len() == 1 => token.to_uppercase(),
        _ => token.to_string(),
    }
}

fn normalize_shortcut(shortcut: &str) -> Result<String, String> {
    let parts = shortcut
        .split('+')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();
    if parts.is_empty() {
        return Err(format!("无法解析快捷键: {shortcut}"));
    }

    let normalized = parts
        .into_iter()
        .map(|part| {
            normalize_modifier_token(part)
                .map(str::to_string)
                .unwrap_or_else(|| normalize_key_token(part))
        })
        .collect::<Vec<_>>()
        .join("+");

    #[cfg(all(desktop, not(test)))]
    {
        normalized
            .parse::<tauri_plugin_global_shortcut::Shortcut>()
            .map(|_| normalized)
            .map_err(|error| format!("无法解析快捷键: {shortcut} ({error})"))
    }

    #[cfg(any(test, not(desktop)))]
    {
        Ok(normalized)
    }
}

fn build_binding(raw_shortcut: &str, action: ShortcutAction) -> Result<ShortcutBinding, String> {
    Ok(ShortcutBinding {
        action,
        shortcut: normalize_shortcut(raw_shortcut)?,
    })
}

fn build_global_shortcut_bindings(config: &ShortcutConfig) -> Result<Vec<ShortcutBinding>, String> {
    let bindings = vec![
        build_binding(&config.input_translate, ShortcutAction::InputTranslate)?,
        build_binding(&config.ocr_translate, ShortcutAction::OcrTranslate)?,
        build_binding(&config.hide_interface, ShortcutAction::HideInterface)?,
        build_binding(
            &config.selection_translate,
            ShortcutAction::SelectionTranslate,
        )?,
        build_binding(&config.ocr_recognize, ShortcutAction::OcrRecognize)?,
        build_binding(&config.open_settings, ShortcutAction::OpenSettings)?,
    ];

    let mut seen = std::collections::HashSet::new();
    for binding in &bindings {
        if !seen.insert(binding.shortcut.clone()) {
            return Err(format!("快捷键冲突: {}", binding.shortcut));
        }
    }
    Ok(bindings)
}

#[cfg(all(desktop, not(test)))]
mod runtime {
    use std::collections::HashMap;

    use serde::Serialize;
    use tauri::{AppHandle, Emitter, Manager, Runtime};
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    use super::{build_global_shortcut_bindings, ShortcutAction, ShortcutBinding, ShortcutConfig};

    const TRAY_EVENT_ACTION: &str = "tray://action";

    #[derive(Clone, Serialize)]
    struct TrayActionPayload {
        action: &'static str,
    }

    fn parse_plugin_shortcut(shortcut: &str) -> Result<Shortcut, String> {
        shortcut
            .parse::<Shortcut>()
            .map_err(|error| format!("无法解析快捷键: {shortcut} ({error})"))
    }

    fn build_action_map(
        bindings: &[ShortcutBinding],
    ) -> Result<HashMap<u32, ShortcutAction>, String> {
        bindings
            .iter()
            .map(|binding| {
                Ok((
                    parse_plugin_shortcut(&binding.shortcut)?.id(),
                    binding.action,
                ))
            })
            .collect()
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

    fn emit_action<R: Runtime>(app: &AppHandle<R>, action: ShortcutAction) {
        if action == ShortcutAction::HideInterface {
            return;
        }
        if let Err(error) = app.emit(
            TRAY_EVENT_ACTION,
            TrayActionPayload {
                action: action.tray_action(),
            },
        ) {
            eprintln!(
                "failed to emit shortcut action `{}`: {error}",
                action.tray_action()
            );
        }
    }

    fn trigger_action<R: Runtime>(app: &AppHandle<R>, action: ShortcutAction) {
        if action == ShortcutAction::HideInterface {
            hide_interface(app);
            return;
        }
        if action.requires_window_display() {
            show_main_window(app);
        }
        emit_action(app, action);
    }

    fn register_shortcuts<R: Runtime>(
        app: &AppHandle<R>,
        bindings: &[ShortcutBinding],
    ) -> Result<(), String> {
        let action_by_id = build_action_map(bindings)?;
        let shortcuts = bindings
            .iter()
            .map(|binding| parse_plugin_shortcut(&binding.shortcut))
            .collect::<Result<Vec<_>, _>>()?;

        app.global_shortcut()
            .unregister_all()
            .map_err(|error| format!("取消注册全局快捷键失败: {error}"))?;

        app.global_shortcut()
            .on_shortcuts(shortcuts, move |app, shortcut, event| {
                if event.state != ShortcutState::Pressed {
                    return;
                }
                if let Some(action) = action_by_id.get(&shortcut.id()) {
                    trigger_action(app, *action);
                }
            })
            .map_err(|error| format!("注册全局快捷键失败: {error}"))
    }

    pub fn sync_shortcuts<R: Runtime>(
        app: &AppHandle<R>,
        config: ShortcutConfig,
    ) -> Result<(), String> {
        let bindings = build_global_shortcut_bindings(&config)?;
        register_shortcuts(app, &bindings)
    }

    pub fn setup<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
        app.plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
        sync_shortcuts(app, ShortcutConfig::defaults()).map_err(std::io::Error::other)?;
        Ok(())
    }
}

#[cfg(all(desktop, not(test)))]
pub use runtime::{setup, sync_shortcuts};

#[cfg(any(test, not(desktop)))]
#[allow(dead_code)]
pub fn setup<R: tauri::Runtime>(_app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    Ok(())
}

#[cfg(any(test, not(desktop)))]
#[allow(dead_code)]
pub fn sync_shortcuts<R: tauri::Runtime>(
    _app: &tauri::AppHandle<R>,
    _config: ShortcutConfig,
) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{build_global_shortcut_bindings, ShortcutAction, ShortcutConfig};

    #[test]
    fn builds_canonical_bindings_from_default_shortcuts() {
        let bindings = build_global_shortcut_bindings(&ShortcutConfig::defaults()).unwrap();
        let shortcuts = bindings
            .into_iter()
            .map(|binding| (binding.action, binding.shortcut))
            .collect::<Vec<_>>();

        assert_eq!(
            shortcuts,
            vec![
                (ShortcutAction::InputTranslate, "Option+F".to_string()),
                (ShortcutAction::OcrTranslate, "Option+S".to_string()),
                (ShortcutAction::HideInterface, "Option+Q".to_string()),
                (ShortcutAction::SelectionTranslate, "Option+D".to_string()),
                (ShortcutAction::OcrRecognize, "Shift+Option+S".to_string()),
                (ShortcutAction::OpenSettings, "CmdOrControl+,".to_string()),
            ]
        );
    }

    #[test]
    fn rejects_conflicting_shortcuts() {
        let error = build_global_shortcut_bindings(&ShortcutConfig {
            hide_interface: "Option + S".to_string(),
            ..ShortcutConfig::defaults()
        })
        .expect_err("should detect conflict");

        assert!(error.contains("快捷键冲突"));
    }

    #[test]
    fn marks_only_window_dependent_actions_for_window_display() {
        assert!(ShortcutAction::OpenSettings.requires_window_display());
        assert!(!ShortcutAction::InputTranslate.requires_window_display());
        assert!(!ShortcutAction::OcrTranslate.requires_window_display());
        assert!(!ShortcutAction::OcrRecognize.requires_window_display());
        assert!(!ShortcutAction::HideInterface.requires_window_display());
        assert!(!ShortcutAction::SelectionTranslate.requires_window_display());
    }
}
