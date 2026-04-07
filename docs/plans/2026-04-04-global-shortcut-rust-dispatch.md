# Global Shortcut Rust Dispatch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make global shortcuts work reliably in tray mode by moving shortcut registration and first-hop dispatch from the frontend window into Rust.

**Architecture:** Rust owns global shortcut registration through `tauri-plugin-global-shortcut` and emits the existing `tray://action` events after optional window reveal. The frontend stops registering global shortcuts and instead syncs the current shortcut settings to Rust whenever settings load or change.

**Tech Stack:** Tauri 2, Rust, React, Vitest, `tauri-plugin-global-shortcut`

---

### Task 1: Add frontend failing test for native shortcut syncing

**Files:**
- Modify: `frontend/src/tests/app/App.test.tsx`
- Test: `frontend/src/tests/app/App.test.tsx`

**Step 1: Write the failing test**
- Add a Tauri-runtime test asserting the app syncs shortcuts to Rust instead of registering JS-side global shortcuts.

**Step 2: Run test to verify it fails**
- Run: `npm --prefix frontend run test -- src/tests/app/App.test.tsx`

**Step 3: Implement minimal frontend sync path**
- Create a native shortcut sync service and wire it from `App.tsx`.

**Step 4: Run test to verify it passes**
- Run: `npm --prefix frontend run test -- src/tests/app/App.test.tsx`

### Task 2: Add Rust failing tests for shortcut parsing and action mapping

**Files:**
- Modify: `src-tauri/src/shortcuts.rs`
- Test: `src-tauri/src/shortcuts.rs`

**Step 1: Write the failing tests**
- Add unit tests covering:
  - human-readable shortcut strings convert to plugin strings
  - duplicate shortcuts are rejected
  - shortcut actions map to the correct tray action and window-show behavior

**Step 2: Run test to verify it fails**
- Run: `cargo test --manifest-path src-tauri/Cargo.toml shortcuts::`

**Step 3: Implement minimal Rust shortcut manager**
- Restore Rust-side registration and dispatch logic.

**Step 4: Run test to verify it passes**
- Run: `cargo test --manifest-path src-tauri/Cargo.toml shortcuts::`

### Task 3: Replace frontend registration with frontend-to-Rust syncing

**Files:**
- Create: `frontend/src/features/settings/nativeShortcutSyncService.ts`
- Modify: `frontend/src/app/App.tsx`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/shortcuts.rs`

**Step 1: Add a Tauri command for shortcut syncing**
- Register a command that accepts the current shortcut config and updates Rust bindings.

**Step 2: Call the command on app startup and shortcut changes**
- Trigger syncing from the frontend when settings load and when shortcut settings change.

**Step 3: Remove JS-side global shortcut registration**
- Delete the `registerGlobalShortcuts` effect from `App.tsx`.

**Step 4: Verify focused tests**
- Run:
  - `npm --prefix frontend run test -- src/tests/app/App.test.tsx`
  - `cargo test --manifest-path src-tauri/Cargo.toml shortcuts::`

### Task 4: Verify the integrated result

**Files:**
- Modify: `frontend/src/tests/features/globalShortcutService.test.ts` or remove if obsolete

**Step 1: Clean up obsolete tests**
- Remove or update frontend tests that assume JS-side global shortcut registration still exists.

**Step 2: Run verification**
- Run:
  - `npm --prefix frontend run typecheck`
  - `npm --prefix frontend run test`
  - `cargo check --manifest-path src-tauri/Cargo.toml`
