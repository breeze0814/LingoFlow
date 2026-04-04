#[cfg(target_os = "windows")]
use lingoflow_lib::{build_clipboard_wait_script, build_region_capture_script};

#[cfg(target_os = "windows")]
#[test]
fn clipboard_wait_script_does_not_launch_screenclip() {
    let script = build_clipboard_wait_script("C:\\temp\\capture.png", 120);

    assert!(
        !script.contains("ms-screenclip"),
        "clipboard waiter should not launch screenclip itself"
    );
    assert!(
        script.contains("ContainsImage"),
        "clipboard waiter should poll clipboard image availability"
    );
}

#[cfg(target_os = "windows")]
#[test]
fn region_capture_script_uses_copy_from_screen() {
    let script = build_region_capture_script("C:\\temp\\capture.png", 100, 200, 300, 400);

    assert!(
        script.contains("CopyFromScreen"),
        "direct region capture should copy pixels from the screen"
    );
    assert!(
        !script.contains("ms-screenclip"),
        "direct region capture should not depend on system snipping ui"
    );
    assert!(
        script.contains("CopyPixelOperation]::SourceCopy"),
        "direct region capture should explicitly use SourceCopy"
    );
}
