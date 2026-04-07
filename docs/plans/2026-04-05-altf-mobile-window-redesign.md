# Alt+F Mobile Window Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the `Alt+F` input translation window into a narrow, mobile-like vertical tool window with active language switching, provider accordions, and a single featured result.

**Architecture:** Keep the existing `ocr_result` runtime entry but change its payload and panel model so the window can hold source/target language codes and switch them in-place. Replace the current wide workbench UI with a compact single-column layout designed around a fixed top area and a scrollable result area.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, CSS modules-by-file pattern already used in `frontend/src/styles`

---

### Task 1: Lock the new panel structure with tests

**Files:**
- Modify: `frontend/src/tests/features/OcrResultPanel.test.tsx`

**Step 1: Write the failing test**

Add assertions for:
- top actions: `翻译 / 复制 / 清空 / 置顶`
- language controls: source + target labels
- provider section title
- featured result section title

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test -- src/tests/features/OcrResultPanel.test.tsx`

Expected: FAIL because current wide workbench does not render the compact mobile-window structure.

**Step 3: Write minimal implementation**

Update `OcrResultPanel` and its child components so the required labels and controls exist.

**Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test -- src/tests/features/OcrResultPanel.test.tsx`

Expected: PASS

### Task 2: Add active language switching to the window payload

**Files:**
- Modify: `frontend/src/features/ocr/ocrResultWindowBridge.ts`
- Modify: `frontend/src/features/ocr/translationWorkspacePayload.ts`
- Modify: `frontend/src/features/ocr/translationWorkspaceService.ts`
- Modify: `frontend/src/features/task/taskService.ts`
- Modify: `frontend/src/features/ocr/OcrResultWindowApp.tsx`
- Test: `frontend/src/tests/features/ocrResultWindowBridge.test.ts`
- Test: `frontend/src/tests/features/OcrResultWindowApp.test.tsx`

**Step 1: Write the failing tests**

Add tests covering:
- payload includes source language code and label
- input translation submits with current source/target codes
- swapping or changing languages updates panel state

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test -- src/tests/features/ocrResultWindowBridge.test.ts src/tests/features/OcrResultWindowApp.test.tsx`

Expected: FAIL because the payload currently lacks source language code and the panel cannot change direction.

**Step 3: Write minimal implementation**

Thread `sourceLanguageCode` through payload creation, runtime state, and submit calls. Add local panel callbacks for changing source/target languages.

**Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test -- src/tests/features/ocrResultWindowBridge.test.ts src/tests/features/OcrResultWindowApp.test.tsx`

Expected: PASS

### Task 3: Replace the wide workbench with the compact Alt+F UI

**Files:**
- Modify: `frontend/src/features/ocr/OcrResultPanel.tsx`
- Modify or replace: `frontend/src/features/ocr/OcrResultWorkbench.tsx`
- Modify or replace: `frontend/src/features/ocr/OcrResultWorkbenchSections.tsx`
- Modify or replace: `frontend/src/features/ocr/ocrResultWorkbenchModel.ts`
- Modify: `frontend/src/styles/ocr-result-panel.css`
- Modify: `frontend/src/styles/ocr-result-workbench-shell.css`
- Modify: `frontend/src/styles/ocr-result-workbench-cards.css`

**Step 1: Write the failing test**

Use Task 1 test additions as the UI guardrail.

**Step 2: Run test to verify it fails**

Reuse the panel test command from Task 1.

**Step 3: Write minimal implementation**

Build:
- thin top bar
- multi-line input area
- fixed action row
- active language row
- provider accordion list
- featured result card
- collapsible secondary results

Keep the layout single-column and narrow-window-first.

**Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test -- src/tests/features/OcrResultPanel.test.tsx`

Expected: PASS

### Task 4: Update preview and window dimensions

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `frontend/src/features/ocr/OcrPreviewApp.tsx`
- Modify: `frontend/src/main.tsx`

**Step 1: Write the failing verification target**

Define the intended result:
- `ocr_result` window moves toward `410 x 720`
- preview route renders the new compact layout

**Step 2: Implement**

Update the Tauri window size and make preview data reflect the Alt+F scenario instead of the wide comparison dashboard.

**Step 3: Verify**

Run:
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run test -- src/tests/features/OcrResultPanel.test.tsx src/tests/features/ocrResultWindowBridge.test.ts src/tests/features/OcrResultWindowApp.test.tsx`

Expected: PASS

### Task 5: Capture a fresh preview image

**Files:**
- Update artifact: `ocr-workbench-preview-tall.png`

**Step 1: Start preview server**

Run: `npm --prefix frontend run dev -- --host 127.0.0.1 --port 4173`

**Step 2: Capture preview**

Use headless Edge against `http://127.0.0.1:4173/?window=ocr_preview`

**Step 3: Verify final state**

Run:
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run test -- src/tests/features/OcrResultPanel.test.tsx src/tests/features/ocrResultWindowBridge.test.ts src/tests/features/OcrResultWindowApp.test.tsx`

Expected: PASS with updated preview image matching the narrow-window design.
