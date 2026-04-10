use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Output, Stdio};

use serde::{Deserialize, Serialize};

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;

const HELPER_EXECUTABLE: &str = "lingoflow-helper";
const HELPER_PATH_ENV: &str = "LINGOFLOW_HELPER_PATH";

#[derive(Debug, Clone, Default, Serialize)]
pub struct HelperPayload {
    #[serde(rename = "imagePath", skip_serializing_if = "Option::is_none")]
    pub image_path: Option<String>,
    #[serde(rename = "sourceLangHint", skip_serializing_if = "Option::is_none")]
    pub source_lang_hint: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct HelperResponse {
    pub ok: bool,
    pub data: Option<HashMap<String, String>>,
    pub error: Option<HelperError>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct HelperError {
    pub code: Option<String>,
    pub message: Option<String>,
    pub retryable: Option<bool>,
}

#[derive(Serialize)]
struct HelperRequest {
    command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    payload: Option<HelperPayload>,
}

pub fn run_helper(
    command: &str,
    payload: Option<HelperPayload>,
) -> Result<HelperResponse, AppError> {
    let helper_path = resolve_helper_executable_path()?;
    let mut child = spawn_helper_process(&helper_path)?;
    let request = encode_helper_request(command, payload)?;
    write_helper_request(&mut child, &request)?;
    let output = wait_helper_output(child)?;
    parse_helper_response(output)
}

fn resolve_helper_executable_path() -> Result<PathBuf, AppError> {
    if let Ok(path) = std::env::var(HELPER_PATH_ENV) {
        return ensure_helper_exists(PathBuf::from(path), HELPER_PATH_ENV);
    }

    let current_exe = std::env::current_exe().map_err(|error| {
        AppError::new(
            ErrorCode::InternalError,
            format!("Failed to resolve current executable path: {error}"),
            false,
        )
    })?;

    let candidates = helper_path_candidates(&current_exe);
    for candidate in &candidates {
        if candidate.is_file() {
            return Ok(candidate.clone());
        }
    }

    Err(AppError::new(
        ErrorCode::InternalError,
        format!(
            "Helper executable not found. Checked paths: {}",
            format_candidate_list(&candidates)
        ),
        false,
    ))
}

fn ensure_helper_exists(path: PathBuf, source: &str) -> Result<PathBuf, AppError> {
    if path.is_file() {
        return Ok(path);
    }
    Err(AppError::new(
        ErrorCode::InternalError,
        format!(
            "{source} points to an invalid helper executable path: {}",
            path.display()
        ),
        false,
    ))
}

fn helper_path_candidates(current_exe: &Path) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let Some(exe_dir) = current_exe.parent() else {
        return candidates;
    };

    append_helper_candidates(&mut candidates, exe_dir);
    if exe_dir.file_name().and_then(|name| name.to_str()) == Some("deps") {
        if let Some(parent) = exe_dir.parent() {
            append_helper_candidates(&mut candidates, parent);
        }
    }
    candidates
}

fn append_helper_candidates(candidates: &mut Vec<PathBuf>, directory: &Path) {
    candidates.push(directory.join(HELPER_EXECUTABLE));
    if let Some(target_suffix) = helper_target_suffix() {
        candidates.push(directory.join(format!("{HELPER_EXECUTABLE}-{target_suffix}")));
    }
}

fn helper_target_suffix() -> Option<&'static str> {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    return Some("aarch64-apple-darwin");
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    return Some("x86_64-apple-darwin");
    #[cfg(not(target_os = "macos"))]
    return None;
}

fn format_candidate_list(paths: &[PathBuf]) -> String {
    paths
        .iter()
        .map(|path| path.display().to_string())
        .collect::<Vec<_>>()
        .join(", ")
}

fn spawn_helper_process(helper_path: &Path) -> Result<Child, AppError> {
    Command::new(helper_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!(
                    "Failed to start helper process at {}: {error}",
                    helper_path.display()
                ),
                false,
            )
        })
}

fn encode_helper_request(
    command: &str,
    payload: Option<HelperPayload>,
) -> Result<Vec<u8>, AppError> {
    serde_json::to_vec(&HelperRequest {
        command: command.to_string(),
        payload,
    })
    .map_err(|error| {
        AppError::new(
            ErrorCode::InternalError,
            format!("Failed to encode helper request: {error}"),
            false,
        )
    })
}

fn write_helper_request(child: &mut Child, payload: &[u8]) -> Result<(), AppError> {
    if let Some(stdin) = child.stdin.as_mut() {
        return stdin.write_all(payload).map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!("Failed to write helper request: {error}"),
                false,
            )
        });
    }
    Err(AppError::new(
        ErrorCode::InternalError,
        "Helper stdin is unavailable",
        false,
    ))
}

fn wait_helper_output(child: Child) -> Result<Output, AppError> {
    child.wait_with_output().map_err(|error| {
        AppError::new(
            ErrorCode::InternalError,
            format!("Failed to read helper output: {error}"),
            false,
        )
    })
}

fn parse_helper_response(output: Output) -> Result<HelperResponse, AppError> {
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::new(
            ErrorCode::InternalError,
            format!("Helper process failed: {}", stderr.trim()),
            true,
        ));
    }

    serde_json::from_slice::<HelperResponse>(&output.stdout).map_err(|error| {
        AppError::new(
            ErrorCode::ProviderInvalidResponse,
            format!("Invalid helper response: {error}"),
            false,
        )
    })
}

#[cfg(test)]
mod tests {
    use super::{helper_path_candidates, HELPER_EXECUTABLE};
    use std::path::Path;

    #[test]
    fn includes_same_directory_candidate() {
        let executable_path = Path::new("/tmp/lingoflow/target/debug/lingoflow");
        let candidates = helper_path_candidates(executable_path);
        assert!(candidates
            .iter()
            .any(|path| path.ends_with(Path::new("target/debug").join(HELPER_EXECUTABLE))));
    }

    #[test]
    fn includes_parent_directory_when_running_from_deps() {
        let executable_path = Path::new("/tmp/lingoflow/target/debug/deps/lingoflow-tests");
        let candidates = helper_path_candidates(executable_path);
        assert!(candidates
            .iter()
            .any(|path| path.ends_with(Path::new("target/debug").join(HELPER_EXECUTABLE))));
    }
}
