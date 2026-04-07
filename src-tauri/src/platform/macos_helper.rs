use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, Command, Output, Stdio};

use serde::{Deserialize, Serialize};

use crate::errors::app_error::AppError;
use crate::errors::error_code::ErrorCode;

const HELPER_EXECUTABLE: &str = "lingoflow-helper";
const HELPER_PACKAGE_PATH: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../platform/macos/helper");
const HELPER_SCRATCH_SUBDIR: &str = "Library/Caches/LingoFlow/swift-helper";

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
    ensure_helper_package_exists()?;
    let mut child = spawn_helper_process()?;
    let request = encode_helper_request(command, payload)?;
    write_helper_request(&mut child, &request)?;
    let output = wait_helper_output(child)?;
    parse_helper_response(output)
}

fn ensure_helper_package_exists() -> Result<(), AppError> {
    if std::path::Path::new(HELPER_PACKAGE_PATH).exists() {
        return Ok(());
    }
    Err(AppError::new(
        ErrorCode::InternalError,
        format!("Helper package path not found: {HELPER_PACKAGE_PATH}"),
        false,
    ))
}

fn spawn_helper_process() -> Result<Child, AppError> {
    let scratch_path = helper_scratch_path()?;
    Command::new("swift")
        .args([
            "run",
            "--scratch-path",
            scratch_path.as_str(),
            "--package-path",
            HELPER_PACKAGE_PATH,
            HELPER_EXECUTABLE,
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            AppError::new(
                ErrorCode::InternalError,
                format!("Failed to start helper process: {error}"),
                false,
            )
        })
}

fn helper_scratch_path() -> Result<String, AppError> {
    let home = std::env::var("HOME").map_err(|error| {
        AppError::new(
            ErrorCode::InternalError,
            format!("Failed to read HOME for helper scratch path: {error}"),
            false,
        )
    })?;
    let path = PathBuf::from(home).join(HELPER_SCRATCH_SUBDIR);
    fs::create_dir_all(&path).map_err(|error| {
        AppError::new(
            ErrorCode::InternalError,
            format!(
                "Failed to prepare helper scratch path {}: {error}",
                path.display()
            ),
            false,
        )
    })?;
    Ok(path.to_string_lossy().into_owned())
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
