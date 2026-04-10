use std::path::PathBuf;
use std::{fs, io::ErrorKind};

use serde_json::json;

use super::{SettingsStore, SETTINGS_FILE_NAME};

fn test_store() -> (SettingsStore, PathBuf) {
    let root = std::env::temp_dir().join(format!(
        "lingoflow-settings-store-test-{}",
        uuid::Uuid::new_v4()
    ));
    (SettingsStore::new(root.clone()), root)
}

fn cleanup_test_dir(root: PathBuf) {
    if let Err(error) = fs::remove_dir_all(root) {
        assert_eq!(
            error.kind(),
            ErrorKind::NotFound,
            "cleanup test dir: {error}"
        );
    }
}

#[test]
fn load_moves_corrupted_settings_to_explicit_backup_path() {
    let (store, root) = test_store();
    fs::create_dir_all(&root).expect("create test dir");
    let settings_path = root.join(SETTINGS_FILE_NAME);
    fs::write(&settings_path, "{invalid").expect("write broken settings");

    let error = store.load().expect_err("corrupted settings should fail");

    assert!(error.message.contains("corrupted"));
    assert!(
        !settings_path.exists(),
        "broken file should be moved out of the way"
    );
    assert!(
        root.join("settings.corrupt.json").exists(),
        "backup path should be created for manual recovery"
    );
    cleanup_test_dir(root);
}

#[test]
fn restore_reinstates_previous_snapshot() {
    let (store, root) = test_store();
    store
        .save(&json!({ "primaryLanguage": "en" }))
        .expect("save initial settings");
    let snapshot = store.snapshot().expect("capture settings snapshot");
    store
        .save(&json!({ "primaryLanguage": "ja" }))
        .expect("save replacement settings");

    store.restore(&snapshot).expect("restore original snapshot");

    let restored = store.load().expect("load restored settings");
    assert_eq!(restored, Some(json!({ "primaryLanguage": "en" })));
    cleanup_test_dir(root);
}
