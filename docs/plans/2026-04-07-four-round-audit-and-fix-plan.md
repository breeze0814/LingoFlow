# Four-Round Audit And Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete four iterative rounds of performance, security, and UX auditing for the current LingoFlow codebase, fixing the highest-value issues with regression coverage.

**Architecture:** Focus changes on the existing Tauri HTTP API, orchestrator execution path, React app shell, and OCR result workspace. Each round starts with a failing test that exposes the issue, followed by the minimal code change and targeted regression verification.

**Tech Stack:** React 19, TypeScript, Vitest, Tauri 2, Rust, Axum, Tokio

---

### Task 1: Round 1 Security Hardening

**Files:**
- Modify: `src-tauri/src/http_api/server.rs`
- Modify: `src-tauri/src/http_api/routes.rs`
- Modify: `src-tauri/src/errors/error_code.rs`
- Test: `src-tauri/src/http_api/controller.rs`
- Test: `src-tauri/src/http_api/routes.rs`

**Step 1: Write failing tests**

- Add a Rust test proving non-loopback host binding is rejected.
- Add route tests proving blank or oversized translate payloads are rejected.

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml http_api -- --nocapture`
Expected: FAIL because the current API accepts unsafe/invalid input.

**Step 3: Write minimal implementation**

- Enforce loopback-only HTTP API binding.
- Validate translate input body before orchestrator execution.

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml http_api -- --nocapture`
Expected: PASS

### Task 2: Round 2 Provider Translation Performance

**Files:**
- Modify: `src-tauri/src/orchestrator/translation_execution.rs`
- Test: `src-tauri/src/orchestrator/translation_execution.rs`

**Step 1: Write failing test**

- Add an async Rust test that proves enabled translate providers run sequentially today and should complete concurrently while preserving stable result ordering.

**Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml translate_with_providers -- --nocapture`
Expected: FAIL because the current implementation is serial.

**Step 3: Write minimal implementation**

- Execute translate provider requests concurrently.
- Keep output order consistent with provider selection order.

**Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml translate_with_providers -- --nocapture`
Expected: PASS

### Task 3: Round 3 Frontend Global Effect Performance

**Files:**
- Modify: `frontend/src/app/App.tsx`
- Test: `frontend/src/tests/app/App.test.tsx`

**Step 1: Write failing tests**

- Add a React test proving tray listener registration does not rebind on settings updates and still uses latest settings.

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test -- src/tests/app/App.test.tsx`
Expected: FAIL because the current app re-registers global listeners on state changes.

**Step 3: Write minimal implementation**

- Stabilize global listener registration with React 19 effect-event style callbacks.
- Keep latest runtime data available without repeated bind/unbind churn.

**Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test -- src/tests/app/App.test.tsx`
Expected: PASS

### Task 4: Round 4 OCR Workspace UX And Accessibility

**Files:**
- Modify: `frontend/src/features/ocr/OcrResultPanel.tsx`
- Modify: `frontend/src/features/ocr/OcrResultWorkbench.tsx`
- Test: `frontend/src/tests/features/OcrResultPanel.test.tsx`

**Step 1: Write failing tests**

- Add React tests proving copy feedback is announced accessibly and language menus can be closed predictably by keyboard or outside interaction.

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test -- src/tests/features/OcrResultPanel.test.tsx`
Expected: FAIL because current status feedback and menu behavior are incomplete.

**Step 3: Write minimal implementation**

- Add accessible live status for copy/error feedback.
- Clear copy timers safely on repeated interactions/unmount.
- Improve language menu accessibility and dismissal behavior.

**Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test -- src/tests/features/OcrResultPanel.test.tsx`
Expected: PASS

### Task 5: Final Verification

**Files:**
- Verify only

**Step 1: Run targeted regression suites**

Run: `npm run typecheck`
Run: `npm run lint`
Run: `npm run test:frontend`
Run: `npm run test:rust`

**Step 2: Confirm actual results**

- Record whether all updated checks pass.
- If any suite fails, return to the responsible round and fix root cause before claiming completion.
