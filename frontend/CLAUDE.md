[Root](../CLAUDE.md) > **frontend**

# Frontend Module

## Module Responsibility

React-based UI layer providing multi-window architecture for settings, translation, OCR results, screenshot overlay, and runtime workers. Communicates with Rust backend exclusively through Tauri commands.

## Entry Points & Startup

- **Main entry**: `src/main.tsx` - Single entry point routing to different apps based on `?window=` URL param
- **Build config**: `vite.config.ts` - Vite configuration
- **Package manifest**: `package.json` - Dependencies and scripts

### Window Routing

The app uses a single HTML entry point with URL-based routing:

- `?window=main` (default) → `App` - Main settings and translator UI
- `?window=ocr_result` → `OcrResultWindowApp` - OCR results display
- `?window=ocr_runtime` → `OcrRuntimeApp` - Hidden Tesseract.js worker
- `?window=screenshot_overlay` → `ScreenshotOverlayApp` - Screenshot selection overlay
- `?window=ocr_preview` → `OcrPreviewApp` - OCR preview window

## Key Interfaces

### Tauri Command Bridge (`infra/tauri/commands.ts`)

Wraps all Rust Tauri commands with TypeScript types:
- Translation commands: `selectionTranslate`, `inputTranslate`
- OCR commands: `ocrRecognize`, `ocrTranslate`, `ocrRecognizeRegion`, `ocrTranslateRegion`
- Settings commands: `loadSettings`, `saveSettings`
- Shortcut commands: `syncGlobalShortcuts`
- Runtime commands: `syncRuntimeSettings`
- Debug commands: `debugPrint`
- Permission commands: `getPermissionStatus`
- Window commands: `setCaptureExcluded`
- Tesseract commands (Windows): `resolveTesseractOcr`

### Feature Modules

**OCR** (`features/ocr/`):
- `OcrResultWindowApp.tsx` - OCR results window
- `OcrResultWorkbench.tsx` - OCR workbench with translation
- `OcrResultPanel.tsx` - OCR result display panel
- `OcrProviderResults.tsx` - Provider-specific results
- `OcrRuntimeApp.tsx` - Tesseract.js worker host
- `OcrPreviewApp.tsx` - OCR preview window
- `ocrResultWindowService.ts` - Window management
- `translationWorkspaceService.ts` - Translation workspace logic
- `ocrTextNormalization.ts` - Text normalization utilities

**Settings** (`features/settings/`):
- `SettingsPanel.tsx` - Main settings UI
- `ProviderPanel.tsx` - Provider configuration
- `ShortcutPanel.tsx` - Shortcut configuration
- `settingsStorage.ts` - Local storage persistence
- `nativeSettingsStorage.ts` - Tauri store persistence
- `settingsTypes.ts` - Settings type definitions
- `permissionStatus.ts` - Permission status types
- `runtimeSettingsSyncService.ts` - Runtime settings sync

**Translator** (`features/translator/`):
- `TranslatorPanel.tsx` - Translation UI
- `inputTranslateEvents.ts` - Input translation events
- `providerMeta.ts` - Provider metadata

**Screenshot** (`features/screenshot/`):
- `ScreenshotOverlayApp.tsx` - Screenshot overlay UI
- `screenshotOverlayService.ts` - Overlay management
- `screenshotOverlayGeometry.ts` - Geometry calculations
- `screenshotOverlayBridge.ts` - Tauri bridge

**Task** (`features/task/`):
- `TaskStatusBar.tsx` - Task status display
- `taskService.ts` - Task management
- `taskReducer.ts` - Task state reducer
- `taskTypes.ts` - Task type definitions
- `taskReporter.ts` - Task reporting

**Selection** (`features/selection/`):
- `selectionWorkflow.ts` - Selection translation workflow

**Tray** (`features/tray/`):
- `trayEvents.ts` - System tray event handling

## Dependencies & Configuration

### Key Dependencies

- `react` (v19.1.1) - UI framework
- `react-dom` (v19.1.1) - React DOM renderer
- `@tauri-apps/api` (v2.8.0) - Tauri API bindings
- `tesseract.js` (v7.0.0) - OCR engine (WebAssembly)
- `@tesseract.js-data/*` - Tesseract language data (chi_sim, deu, eng, fra, jpn, kor)

### Dev Dependencies

- `vite` (v7.1.7) - Build tool
- `typescript` (v5.9.2) - Type checking
- `vitest` (v3.2.4) - Testing framework
- `@testing-library/react` (v16.3.0) - React testing utilities
- `eslint` (v9.36.0) - Linting
- `prettier` (v3.6.2) - Code formatting

### Configuration Files

- `eslint.config.mjs` - ESLint configuration
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Vite build configuration

## Data Models

### Settings Types (`features/settings/settingsTypes.ts`)

- `SettingsState` - Complete app settings
- `TranslateProviderConfig` - Translation provider configuration
- `OcrProviderConfig` - OCR provider configuration
- `ShortcutConfig` - Keyboard shortcut configuration

### Task Types (`features/task/taskTypes.ts`)

- `TaskState` - Task execution state
- `TaskStatus` - Task status enum
- `TaskError` - Task error information

## Testing

### Test Location

All tests in `src/tests/` directory:
- `features/` - Feature-specific tests
- `app/` - App-level tests
- `task/` - Task management tests

### Test Setup

- Framework: Vitest + jsdom
- React testing: @testing-library/react
- Mocking: Vitest built-in mocks

### Running Tests

```bash
npm run test                                           # All frontend tests
npm run test:watch                                     # Watch mode
npx vitest run src/tests/features/shortcutMatcher.test.ts  # Single test
```

### Test Files (20+ test files)

- `SettingsPanel.test.tsx`, `ProviderPanel.test.tsx`, `TranslatorPanel.test.tsx`
- `OcrResultPanel.test.tsx`, `OcrResultWindowApp.test.tsx`, `ScreenshotOverlayApp.test.tsx`
- `App.test.tsx`, `taskReducer.test.ts`, `taskService.test.ts`
- `shortcutMatcher.test.ts`, `settingsStorage.test.ts`, `ocrTextNormalization.test.ts`
- And more...

## Quality Tools

- **TypeScript**: `npm run typecheck` - Type checking
- **ESLint**: `npm run lint` - Linting
- **Prettier**: `npm run format` - Code formatting
- **Vitest**: `npm run test` - Unit tests

## Common Issues

### Tesseract.js Assets

- Tesseract.js requires language data files in `public/tessdata/`
- Assets are synced via `scripts/sync-tesseract-assets.mjs`
- Run automatically on `npm install` and `npm run dev`

### Multi-Window Architecture

- All windows share the same HTML entry point
- Window type determined by `?window=` URL parameter
- Each window has its own React app component
- Windows communicate via Tauri events

### Tauri Runtime Detection

- Use `isTauriRuntime()` to check if running in Tauri
- Some features only work in Tauri (not in `npm run dev:web`)
- Settings persistence differs between Tauri and web mode

## Related Files

### Source Files (50+ TypeScript/TSX files)

**App** (`app/`):
- `App.tsx`, `useAppActions.ts`, `appRuntime.ts`

**Features** (`features/`):
- OCR: 20+ files
- Settings: 15+ files
- Translator: 3 files
- Screenshot: 4 files
- Task: 5 files
- Selection: 1 file
- Tray: 1 file

**Infrastructure** (`infra/`):
- `tauri/commands.ts` - Tauri command bridge

**Tests** (`tests/`):
- 20+ test files covering features, app, and task management

### Style Files (`styles/`)

- `design-tokens.css` - Design system tokens
- `layout.css` - Layout utilities
- `settings-panel.css` - Settings panel styles
- `provider-panel.css` - Provider panel styles
- `ocr-result-panel.css` - OCR result panel styles
- `ocr-result-workbench-shell.css` - Workbench shell styles
- `ocr-result-workbench-cards.css` - Workbench card styles
- `screenshot-overlay.css` - Screenshot overlay styles
- `translator.css` - Translator styles

## Changelog

**2026-04-19 17:26:20** - Initial module documentation created during AI context initialization.
