use std::env;
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;

const HELPER_EXECUTABLE: &str = "lingoflow-helper";
const HELPER_PACKAGE_RELATIVE_PATH: &str = "../platform/macos/helper";
const HELPER_BINARY_OUTPUT_RELATIVE_PATH: &str = "binaries";

fn main() {
    build_macos_helper_if_needed();
    tauri_build::build();
}

fn build_macos_helper_if_needed() {
    if env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("macos") {
        return;
    }
    let manifest_dir = manifest_dir();
    println!(
        "cargo:rerun-if-changed={}",
        manifest_dir
            .join(HELPER_PACKAGE_RELATIVE_PATH)
            .join("Package.swift")
            .display()
    );
    println!(
        "cargo:rerun-if-changed={}",
        manifest_dir
            .join(HELPER_PACKAGE_RELATIVE_PATH)
            .join("Sources")
            .display()
    );
    build_macos_helper(&manifest_dir);
}

fn manifest_dir() -> PathBuf {
    PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR must be set"))
}

fn build_macos_helper(manifest_dir: &Path) {
    let helper_package_dir = manifest_dir.join(HELPER_PACKAGE_RELATIVE_PATH);
    run_swift_build(&helper_package_dir);

    let helper_source_binary = helper_package_dir
        .join(".build")
        .join("release")
        .join(HELPER_EXECUTABLE);
    if !helper_source_binary.is_file() {
        panic!(
            "expected helper binary does not exist: {}",
            helper_source_binary.display()
        );
    }

    let target_triple = env::var("TARGET").expect("TARGET must be set");
    let helper_target_binary_name = format!("{HELPER_EXECUTABLE}-{target_triple}");
    let helper_target_binary_path = manifest_dir
        .join(HELPER_BINARY_OUTPUT_RELATIVE_PATH)
        .join(helper_target_binary_name);
    ensure_binary_parent_dir(&helper_target_binary_path);
    fs::copy(&helper_source_binary, &helper_target_binary_path).unwrap_or_else(|error| {
        panic!(
            "failed to copy helper binary from {} to {}: {error}",
            helper_source_binary.display(),
            helper_target_binary_path.display()
        )
    });
    set_executable_permissions(&helper_target_binary_path);
}

fn run_swift_build(helper_package_dir: &Path) {
    let status = Command::new("swift")
        .args([
            "build",
            "--configuration",
            "release",
            "--product",
            HELPER_EXECUTABLE,
            "--package-path",
        ])
        .arg(helper_package_dir)
        .status()
        .unwrap_or_else(|error| panic!("failed to execute swift build: {error}"));

    if !status.success() {
        panic!("swift build failed for helper package {}", helper_package_dir.display());
    }
}

fn ensure_binary_parent_dir(binary_path: &Path) {
    let parent = binary_path
        .parent()
        .expect("helper target binary path must have a parent directory");
    fs::create_dir_all(parent).unwrap_or_else(|error| {
        panic!(
            "failed to create helper binary output directory {}: {error}",
            parent.display()
        )
    });
}

fn set_executable_permissions(binary_path: &Path) {
    #[cfg(unix)]
    {
        let permissions = fs::Permissions::from_mode(0o755);
        fs::set_permissions(binary_path, permissions).unwrap_or_else(|error| {
            panic!(
                "failed to mark helper binary as executable at {}: {error}",
                binary_path.display()
            )
        });
    }
}
