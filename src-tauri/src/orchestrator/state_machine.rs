use crate::orchestrator::models::TaskStatus;

pub fn is_terminal_status(status: &TaskStatus) -> bool {
    matches!(
        status,
        TaskStatus::Success | TaskStatus::Failure | TaskStatus::Cancelled
    )
}
