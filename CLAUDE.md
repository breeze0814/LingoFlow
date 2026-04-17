# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LingoFlow is a lightweight desktop translator built with **Tauri 2 + React 19 + Rust**. Core features: selection translate, input translate, screenshot OCR, screenshot translate, and local HTTP API. The project supports macOS (V1 complete) and Windows (core features implemented, platform integration in progress).

## Common Commands

```bash
# Development
npm run dev              # Start full Tauri app (frontend + Rust)
npm run dev:web          # Start frontend-only dev server (no Tauri)

# Build
npm run build            # Build full Tauri app
npm run build:frontend   # Build frontend only

# Quality checks
npm run check            # Run typecheck + lint + test (all)
npm run typecheck        # TypeScript type checking
npm run lint             # ESLint (frontend) + Clippy (Rust)
npm run format           # Prettier (frontend) + rustfmt (Rust)
npm run format:check     # Check formatting without writing

# Tests
npm run test             # Run all tests (frontend + Rust)
npm run test:frontend    # Vitest (frontend only)
npm run test:rust        # cargo test with 60s timeout
cd frontend && npx vitest run src/tests/features/shortcutMatcher.test.ts  # Single frontend test
cargo test --manifest-path src-tauri/Cargo.toml <test_name>               # Single Rust test
```

## Architecture

### Three-Layer Structure

```
frontend/          → React + TypeScript + Vite (UI layer)
src-tauri/         → Rust + Tauri 2 + Axum (core logic layer)
platform/macos/    → Swift helper (macOS-specific platform bridge)
```

### Dependency Direction (strict)

- `frontend` → calls Tauri commands only, never touches native APIs directly
- `src-tauri/orchestrator` → depends on `providers`, `storage`, `platform`
- `providers` → never depends on `frontend`
- `platform` → never depends on specific providers
- `http_api` → reuses `orchestrator`, never duplicates business logic

### Rust Backend (`src-tauri/src/`)

| Module | Purpose |
|--------|---------|
| `commands/` | Tauri command handlers (translation, ocr, shortcuts, debug) |
| `orchestrator/` | Task orchestration: models, state machine, service |
| `apiprovider/` | Translation API clients (Baidu, DeepL, Google, Microsoft, Tencent, Youdao) |
| `providers/` | OCR provider implementations (Apple Vision, OpenAI-compatible, Tesseract.js bridge) + provider registry + traits |
| `http_api/` | Local Axum HTTP server (routes + server) |
| `storage/` | Config store + keychain store |
| `errors/` | Unified error codes and AppError type |
| `platform/` | Platform-specific capture (macOS via Swift helper, Windows capture) |
| `shortcuts.rs` | Global shortcut setup |
| `tray.rs` | System tray setup |
| `window_lifecycle.rs` | Window close behavior (hide-to-tray for main window) |
| `app_state.rs` | Shared application state |

### Frontend (`frontend/src/`)

- **Multi-window architecture**: Single entry point (`main.tsx`) routes to different React apps based on `?window=` URL param
  - `main` → `App` (settings + main UI)
  - `ocr_result` → `OcrResultWindowApp`
  - `ocr_runtime` → `OcrRuntimeApp` (hidden, runs Tesseract.js worker)
  - `screenshot_overlay` → `ScreenshotOverlayApp`
  - `ocr_preview` → `OcrPreviewApp`
- **Feature modules**: `features/settings/`, `features/task/`, `features/translator/`, `features/ocr/`, `features/screenshot/`, `features/tray/`
- **Tauri bridge**: `infra/tauri/commands.ts`

### Platform Bridge (`platform/macos/helper/`)

Swift executable communicating with Rust via stdin/stdout JSON bridge. Modules: Capture, OCR (Apple Vision), Permission, Selection, IO.

## Code Style

- **Prettier**: semi, singleQuote, trailingComma 'all', printWidth 100
- **Rust**: `max_width = 100`, soft tabs, Unix newlines, Clippy `too-many-arguments-threshold = 3`
- **Naming**: React components `PascalCase.tsx`, hooks `useXxx.ts`, Rust `snake_case.rs`, Provider IDs `snake_case`
- **ESLint**: unused vars error with `^_` ignore pattern for args

## Test Locations

- Frontend tests: `frontend/src/tests/` (Vitest + jsdom + @testing-library/react)
- Rust unit tests: inline with modules (`#[cfg(test)]`)
- Rust integration tests: `src-tauri/tests/`
- Platform helper tests: `platform/macos/helper/Tests/`

## Key Design Decisions

- Business logic lives in Rust; React layer is presentation + interaction only
- Platform-specific logic (macOS permissions, screen capture) is isolated in `platform/` and the Swift helper
- Errors must be explicitly surfaced, never silently swallowed
- Shared models are defined once, then mapped by frontend and backend
- `tesseract_ocr` command is conditionally compiled out in `#[cfg(test)]` builds
- The `ocr_runtime` window is a hidden WebView that hosts the Tesseract.js worker, bridged to Rust
