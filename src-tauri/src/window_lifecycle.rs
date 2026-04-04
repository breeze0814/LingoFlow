pub const MAIN_WINDOW_LABEL: &str = "main";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CloseRequestAction {
    HideToTray,
    Ignore,
}

pub fn close_request_action(window_label: &str, close_requested: bool) -> CloseRequestAction {
    if close_requested && window_label == MAIN_WINDOW_LABEL {
        return CloseRequestAction::HideToTray;
    }
    CloseRequestAction::Ignore
}

#[cfg(test)]
mod tests {
    use super::{close_request_action, CloseRequestAction, MAIN_WINDOW_LABEL};

    #[test]
    fn hides_main_window_to_tray_on_close_request() {
        assert_eq!(
            close_request_action(MAIN_WINDOW_LABEL, true),
            CloseRequestAction::HideToTray
        );
    }

    #[test]
    fn ignores_non_close_events() {
        assert_eq!(
            close_request_action(MAIN_WINDOW_LABEL, false),
            CloseRequestAction::Ignore
        );
    }

    #[test]
    fn ignores_secondary_window_close_requests() {
        assert_eq!(
            close_request_action("ocr_result", true),
            CloseRequestAction::Ignore
        );
    }
}
