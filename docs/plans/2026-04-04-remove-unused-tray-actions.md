# Remove Unused Tray Actions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove clipboard translate, polish replace, and translate replace from the product surface.

**Architecture:** Delete the three features from tray menus, tray action types, and workspace payload modes so no dead entrypoints remain. Keep the rest of the tray and OCR workspace behavior unchanged.

**Tech Stack:** Tauri 2, Rust, React, Vitest

---

### Task 1: Update tests first

**Files:**
- Modify: `frontend/src/tests/app/App.test.tsx`
- Modify: `src-tauri/src/tray.rs`

**Step 1:** Add or update tests to assert removed tray actions are absent.
**Step 2:** Run targeted tests and confirm failure if references remain.

### Task 2: Remove frontend references

**Files:**
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/src/features/tray/trayEvents.ts`
- Modify: `frontend/src/features/ocr/ocrResultWindowBridge.ts`
- Modify: `frontend/src/features/ocr/translationWorkspacePayload.ts`

**Step 1:** Delete obsolete tray action branch and clipboard workspace mode.
**Step 2:** Remove now-unused helper functions and type members.

### Task 3: Remove Rust tray menu entries

**Files:**
- Modify: `src-tauri/src/tray.rs`

**Step 1:** Delete clipboard translate, polish replace, and translate replace menu items.
**Step 2:** Remove associated menu ids and handlers.

### Task 4: Verify

**Files:**
- Test: `frontend/src/tests/app/App.test.tsx`

**Step 1:** Run `npm --prefix frontend run typecheck`
**Step 2:** Run `npm --prefix frontend run test`
**Step 3:** Run `cargo test --manifest-path src-tauri/Cargo.toml tray::`
**Step 4:** Run `cargo check --manifest-path src-tauri/Cargo.toml`
