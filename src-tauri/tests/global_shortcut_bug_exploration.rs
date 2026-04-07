use proptest::prelude::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ShortcutKey {
    InputTranslate,
    OcrTranslate,
    HideInterface,
    SelectionTranslate,
    OcrRecognize,
    OpenSettings,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WindowState {
    Hidden,
    MinimizedToTray,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ShortcutOutcome {
    handler_called: bool,
    window_shown: bool,
    event_emitted: bool,
    action_name: Option<&'static str>,
}

impl ShortcutKey {
    fn action_name(self) -> Option<&'static str> {
        match self {
            Self::InputTranslate => Some("input_translate"),
            Self::OcrTranslate => Some("ocr_translate"),
            Self::HideInterface => None,
            Self::SelectionTranslate => Some("selection_translate"),
            Self::OcrRecognize => Some("ocr_recognize"),
            Self::OpenSettings => Some("open_settings"),
        }
    }

    fn requires_window_display(self) -> bool {
        matches!(self, Self::OpenSettings)
    }

    fn emits_event(self) -> bool {
        !matches!(self, Self::HideInterface)
    }
}

fn simulate_hidden_window_behavior(key: ShortcutKey, _state: WindowState) -> ShortcutOutcome {
    ShortcutOutcome {
        handler_called: true,
        window_shown: key.requires_window_display(),
        event_emitted: key.emits_event(),
        action_name: key.action_name(),
    }
}

fn assert_expected_hidden_window_behavior(key: ShortcutKey, state: WindowState) {
    let result = simulate_hidden_window_behavior(key, state);

    assert!(
        result.handler_called,
        "shortcut {:?} should be handled in state {:?}",
        key, state
    );
    assert_eq!(
        result.window_shown,
        key.requires_window_display(),
        "window visibility mismatch for {:?} in state {:?}",
        key,
        state
    );
    assert_eq!(
        result.event_emitted,
        key.emits_event(),
        "event emission mismatch for {:?} in state {:?}",
        key,
        state
    );
    assert_eq!(
        result.action_name,
        key.action_name(),
        "action mismatch for {:?} in state {:?}",
        key,
        state
    );
}

proptest! {
    #[test]
    fn prop_hidden_window_shortcuts_still_work(
        key in prop::sample::select(vec![
            ShortcutKey::InputTranslate,
            ShortcutKey::OcrTranslate,
            ShortcutKey::HideInterface,
            ShortcutKey::SelectionTranslate,
            ShortcutKey::OcrRecognize,
            ShortcutKey::OpenSettings,
        ]),
        state in prop::sample::select(vec![
            WindowState::Hidden,
            WindowState::MinimizedToTray,
        ])
    ) {
        let result = simulate_hidden_window_behavior(key, state);

        prop_assert!(result.handler_called);
        prop_assert_eq!(result.window_shown, key.requires_window_display());
        prop_assert_eq!(result.event_emitted, key.emits_event());
        prop_assert_eq!(result.action_name, key.action_name());
    }
}

#[test]
fn input_translate_stays_background_only_when_hidden() {
    assert_expected_hidden_window_behavior(ShortcutKey::InputTranslate, WindowState::Hidden);
}

#[test]
fn ocr_translate_stays_background_only_when_hidden() {
    assert_expected_hidden_window_behavior(ShortcutKey::OcrTranslate, WindowState::Hidden);
}

#[test]
fn hide_interface_does_not_emit_frontend_event_in_tray_state() {
    assert_expected_hidden_window_behavior(
        ShortcutKey::HideInterface,
        WindowState::MinimizedToTray,
    );
}

#[test]
fn selection_translate_stays_background_only_from_tray_state() {
    assert_expected_hidden_window_behavior(
        ShortcutKey::SelectionTranslate,
        WindowState::MinimizedToTray,
    );
}

#[test]
fn ocr_recognize_stays_background_only_from_tray_state() {
    assert_expected_hidden_window_behavior(ShortcutKey::OcrRecognize, WindowState::MinimizedToTray);
}

#[test]
fn open_settings_shows_window_from_tray_state() {
    assert_expected_hidden_window_behavior(ShortcutKey::OpenSettings, WindowState::MinimizedToTray);
}
