[Root](../CLAUDE.md) > **src-tauri**

# Rust Backend Module

## Module Responsibility

Core application logic layer built with Tauri 2 and Rust. Handles all business logic, API integrations, platform-specific operations, and exposes Tauri commands to the frontend.

## Entry Points & Startup

- **Main entry**: `src/lib.rs` - Exports `run()` function called by Tauri
- **Build script**: `build.rs` - Tauri build configuration
- **Configuration**: `tauri.conf.json` - Tauri app configuration
- **Cargo manifest**: `Cargo.toml` - Dependencies and build settings

### Startup Sequence

1. `run()` initializes Tauri builder with plugins (tauri-plugin-store)
2. `setup()` creates `AppState` with all services
3. Conditionally starts HTTP API server if enabled
4. Registers global shortcuts and system tray
5. Hides main window (show on demand)

## Key Interfaces

### Tauri Commands (exposed to frontend)

**Translation commands** (`commands/translation.rs`):
- `selection_translate` - Translate selected text
- `read_selection_text` - Read clipboard/selection
- `input_translate` - Translate user input

**OCR commands** (`commands/ocr.rs`):
- `ocr_recognize` - OCR from image
- `ocr_translate` - OCR + translate
- `ocr_recognize_region` - OCR from screen region
- `ocr_translate_region` - OCR + translate from region

**Settings commands** (`commands/settings.rs`):
- `load_settings` - Load app settings
- `save_settings` - Save app settings

**Shortcut commands** (`commands/shortcuts.rs`):
- `sync_global_shortcuts` - Update global shortcuts

**Runtime settings** (`commands/runtime_settings.rs`):
- `sync_runtime_settings` - Sync runtime provider settings

**Debug commands** (`commands/debug.rs`):
- `debug_print` - Debug logging

**Permission commands** (`commands/permissions.rs`):
- `get_permission_status` - Check platform permissions

**Window commands** (`commands/window_display.rs`):
- `set_capture_excluded` - Exclude window from screen capture

**Tesseract OCR** (Windows only, `commands/tesseract_ocr.rs`):
- `resolve_tesseract_ocr` - Bridge to Tesseract.js in WebView

### HTTP API (external integrations)

**Routes** (`http_api/routes.rs`):
- `POST /translate` - Translation endpoint
- `POST /ocr` - OCR endpoint
- `POST /ocr-translate` - OCR + translate endpoint

## Dependencies & Configuration

### Key Dependencies

- `tauri` (v2) - Desktop app framework
- `axum` (v0.8) - HTTP server
- `reqwest` (v0.12) - HTTP client for API providers
- `serde` + `serde_json` - Serialization
- `tokio` - Async runtime
- `tauri-plugin-store` - Persistent storage
- `tauri-plugin-global-shortcut` - Global shortcuts
- `keyring` (v3) - Secure credential storage
- `windows` (Windows only) - Windows API bindings

### Configuration Files

- `clippy.toml` - Clippy linting rules
- `rustfmt.toml` - Code formatting rules
- `tauri.conf.json` - Tauri app configuration

## Data Models

### Core Models (`orchestrator/models.rs`)

- `TranslationTask` - Translation request/response
- `OcrTask` - OCR request/response
- `TaskState` - Task execution state machine
- `ProviderConfig` - Provider configuration

### Settings Models

- `AppSettings` - Application settings (stored in tauri-plugin-store)
- `RuntimeSettings` - Runtime provider settings (synced from frontend)

## Testing

### Unit Tests

Inline with modules using `#[cfg(test)]`:
- Provider implementations
- Orchestrator logic
- Error handling
- Utility functions

### Integration Tests (`tests/`)

- `smoke.rs` - Basic app startup
- `global_shortcut_preservation.rs` - Shortcut persistence
- `windows_capture_script.rs` - Windows capture script generation

### Running Tests

```bash
npm run test:rust                                      # All Rust tests
cargo test --manifest-path src-tauri/Cargo.toml       # Direct cargo test
cargo test --manifest-path src-tauri/Cargo.toml <name> # Single test
```

## Quality Tools

- **Clippy**: `cargo clippy --all-targets --all-features`
- **rustfmt**: `cargo fmt`
- **Type checking**: Built into Rust compiler

## Common Issues

### Platform-Specific Compilation

- Some modules are conditionally compiled based on target OS
- `#[cfg(target_os = "macos")]` - macOS only
- `#[cfg(target_os = "windows")]` - Windows only
- `#[cfg(not(test))]` - Excluded in test builds

### Tesseract.js Bridge

- Only available on Windows in non-test builds
- Uses hidden WebView window to run Tesseract.js worker
- Communicates via Tauri events

## Related Files

### Source Files (33 Rust modules)

**Commands** (9 files):
- `commands/debug.rs`, `commands/ocr.rs`, `commands/permissions.rs`
- `commands/runtime_settings.rs`, `commands/settings.rs`, `commands/shortcuts.rs`
- `commands/tesseract_ocr.rs`, `commands/translation.rs`, `commands/window_display.rs`

**Orchestrator** (4 files):
- `orchestrator/models.rs`, `orchestrator/ocr_execution.rs`
- `orchestrator/ocr_text.rs`, `orchestrator/service.rs`

**Providers** (10 files):
- `providers/apple_vision_ocr.rs`, `providers/base64.rs`, `providers/openai_compatible.rs`
- `providers/openai_compatible_ocr.rs`, `providers/registry.rs`, `providers/runtime_ocr_factory.rs`
- `providers/runtime_translate_factory.rs`, `providers/tesseract_js_bridge.rs`
- `providers/tesseract_js_ocr.rs`, `providers/traits.rs`

**API Providers** (10 files):
- `apiprovider/baidu_fanyi.rs`, `apiprovider/bing_web.rs`, `apiprovider/deepl_free.rs`
- `apiprovider/google_translate.rs`, `apiprovider/http_error.rs`, `apiprovider/microsoft_translator.rs`
- `apiprovider/runtime_config.rs`, `apiprovider/tencent_tmt.rs`, `apiprovider/youdao_web.rs`

**HTTP API** (6 files):
- `http_api/controller.rs`, `http_api/routes.rs`, `http_api/runtime_provider_settings.rs`
- `http_api/server.rs`, `http_api/state.rs`, `http_api/ui_dispatcher.rs`

**Storage** (2 files):
- `storage/config_store.rs`, `storage/settings_store.rs`

**Platform** (5 files):
- `platform/capture.rs`, `platform/macos_helper.rs`, `platform/permissions.rs`
- `platform/selection.rs`, `platform/windows_capture/`

**Other**:
- `errors/mod.rs`, `app_state.rs`, `shortcuts.rs`, `tray.rs`, `window_lifecycle.rs`
- `runtime_settings_sync.rs`, `settings_persistence.rs`, `settings_secret_fields.rs`

### Test Files (4 integration tests)

- `tests/smoke.rs`
- `tests/global_shortcut_preservation.rs`
- `tests/global_shortcut_bug_exploration.rs`
- `tests/windows_capture_script.rs`

## Changelog

**2026-04-19 17:26:20** - Initial module documentation created during AI context initialization.
