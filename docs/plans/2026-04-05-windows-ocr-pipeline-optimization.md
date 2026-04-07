# Windows OCR Pipeline Optimization

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce Alt+S → OCR result latency on Windows by eliminating PowerShell subprocess overhead, consolidating IPC round-trips, and parallelizing window operations.

**Architecture:** Five independent optimizations applied incrementally: (1) Replace PowerShell-based screen capture with Rust native Win32 API via the `windows` crate, (2) Use existing `ocr_translate_region` command instead of two-step OCR+translate in the frontend, (3) Parallelize async monitor resolution and window creation, (4) Pre-create overlay and result windows at startup, (5) Use `WDA_EXCLUDEFROMCAPTURE` to skip the hide-and-wait dance.

**Tech Stack:** Rust + `windows` crate (Win32 GDI + `SetWindowDisplayAffinity`), TypeScript/React (Tauri frontend), Tauri 2 IPC

---

### Task 1: Add `windows` crate dependency

**Files:**
- Modify: `src-tauri/Cargo.toml`

**Step 1: Add the `windows` crate with required Win32 features**

In `src-tauri/Cargo.toml`, add under `[dependencies]`:

```toml
[target.'cfg(target_os = "windows")'.dependencies]
windows = { version = "0.58", features = [
    "Win32_Graphics_Gdi",
    "Win32_UI_WindowsAndMessaging",
    "Win32_Foundation",
] }
```

**Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors

**Step 3: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "build: add windows crate for native Win32 screen capture"
```

---

### Task 2: Implement native Win32 region capture function

**Files:**
- Modify: `src-tauri/src/platform/windows_capture.rs`

**Step 1: Write the failing test**

Add at the bottom of `src-tauri/src/platform/windows_capture.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_region_capture_produces_valid_png() {
        // Capture a 100x100 region from the top-left corner of the screen
        let output_path = std::env::temp_dir().join("test-native-capture.png");
        let rect = PixelCaptureRect {
            x: 0,
            y: 0,
            width: 100,
            height: 100,
        };
        native_capture_region(&output_path, &rect).expect("native capture should succeed");
        assert!(output_path.exists(), "output file should be created");
        let metadata = std::fs::metadata(&output_path).expect("should read metadata");
        assert!(metadata.len() > 0, "output file should not be empty");
        // Check PNG magic bytes
        let bytes = std::fs::read(&output_path).expect("should read file");
        assert_eq!(&bytes[..4], &[0x89, 0x50, 0x4E, 0x47], "should be a valid PNG");
        let _ = std::fs::remove_file(&output_path);
    }

    #[test]
    fn native_region_capture_rejects_zero_dimensions() {
        let output_path = std::env::temp_dir().join("test-native-capture-zero.png");
        let rect = PixelCaptureRect {
            x: 0,
            y: 0,
            width: 0,
            height: 100,
        };
        let result = native_capture_region(&output_path, &rect);
        assert!(result.is_err(), "zero-width capture should fail");
        let _ = std::fs::remove_file(&output_path);
    }
}
```

**Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test --lib platform::windows_capture::tests::native_region_capture_produces_valid_png -- --nocapture`
Expected: FAIL with "cannot find function `native_capture_region`"

**Step 3: Implement `native_capture_region`**

Add this function in `src-tauri/src/platform/windows_capture.rs`, above the `#[cfg(test)]` block, guarded by `#[cfg(target_os = "windows")]`:

```rust
#[cfg(target_os = "windows")]
use std::io::Write as IoWrite;

#[cfg(target_os = "windows")]
pub fn native_capture_region(
    output_path: &Path,
    rect: &PixelCaptureRect,
) -> Result<(), AppError> {
    use windows::Win32::Foundation::*;
    use windows::Win32::Graphics::Gdi::*;

    if rect.width <= 0 || rect.height <= 0 {
        return Err(AppError::new(
            ErrorCode::NoSelection,
            "Capture region is empty",
            false,
        ));
    }

    unsafe {
        let hdc_screen = GetDC(None);
        if hdc_screen.is_invalid() {
            return Err(AppError::new(
                ErrorCode::InternalError,
                "Failed to get screen device context",
                false,
            ));
        }

        let hdc_mem = CreateCompatibleDC(hdc_screen);
        if hdc_mem.is_invalid() {
            ReleaseDC(None, hdc_screen);
            return Err(AppError::new(
                ErrorCode::InternalError,
                "Failed to create compatible device context",
                false,
            ));
        }

        let hbm = CreateCompatibleBitmap(hdc_screen, rect.width, rect.height);
        if hbm.is_invalid() {
            let _ = DeleteDC(hdc_mem);
            ReleaseDC(None, hdc_screen);
            return Err(AppError::new(
                ErrorCode::InternalError,
                "Failed to create compatible bitmap",
                false,
            ));
        }

        let old_bm = SelectObject(hdc_mem, hbm);
        let blt_ok = BitBlt(
            hdc_mem,
            0,
            0,
            rect.width,
            rect.height,
            hdc_screen,
            rect.x,
            rect.y,
            SRCCOPY,
        );

        if blt_ok.is_err() {
            SelectObject(hdc_mem, old_bm);
            let _ = DeleteObject(hbm);
            let _ = DeleteDC(hdc_mem);
            ReleaseDC(None, hdc_screen);
            return Err(AppError::new(
                ErrorCode::InternalError,
                "BitBlt screen capture failed",
                false,
            ));
        }

        // Read bitmap pixel data
        let bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: rect.width,
                biHeight: -rect.height, // top-down DIB
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD::default()],
        };

        let row_bytes = (rect.width as usize) * 4;
        let mut pixels = vec![0u8; row_bytes * rect.height as usize];

        GetDIBits(
            hdc_mem,
            hbm,
            0,
            rect.height as u32,
            Some(pixels.as_mut_ptr().cast()),
            &bmi as *const _ as *mut _,
            DIB_RGB_COLORS,
        );

        // Cleanup GDI resources
        SelectObject(hdc_mem, old_bm);
        let _ = DeleteObject(hbm);
        let _ = DeleteDC(hdc_mem);
        ReleaseDC(None, hdc_screen);

        // Convert BGRA → RGBA
        for chunk in pixels.chunks_exact_mut(4) {
            chunk.swap(0, 2);
        }

        // Encode minimal PNG
        write_rgba_png(output_path, rect.width as u32, rect.height as u32, &pixels)
    }
}

#[cfg(target_os = "windows")]
fn write_rgba_png(
    output_path: &Path,
    width: u32,
    height: u32,
    rgba_pixels: &[u8],
) -> Result<(), AppError> {
    // Build raw image data with filter byte per row
    let row_len = (width as usize) * 4;
    let mut raw_data = Vec::with_capacity((row_len + 1) * height as usize);
    for row in rgba_pixels.chunks_exact(row_len) {
        raw_data.push(0u8); // filter: None
        raw_data.extend_from_slice(row);
    }

    // Deflate using miniz_oxide (bundled in std since Rust 1.x, or via flate2-like approach)
    // We use a simple zlib compress via raw deflate wrapper
    let compressed = deflate_zlib(&raw_data);

    let mut file = std::fs::File::create(output_path).map_err(|e| {
        AppError::new(
            ErrorCode::InternalError,
            format!("Failed to create capture file: {e}"),
            false,
        )
    })?;

    // PNG signature
    file.write_all(&[137, 80, 78, 71, 13, 10, 26, 10])
        .map_err(|e| map_png_write_error(e))?;

    // IHDR chunk
    let mut ihdr = Vec::with_capacity(13);
    ihdr.extend_from_slice(&width.to_be_bytes());
    ihdr.extend_from_slice(&height.to_be_bytes());
    ihdr.push(8); // bit depth
    ihdr.push(6); // color type: RGBA
    ihdr.push(0); // compression
    ihdr.push(0); // filter
    ihdr.push(0); // interlace
    write_png_chunk(&mut file, b"IHDR", &ihdr)?;

    // IDAT chunk
    write_png_chunk(&mut file, b"IDAT", &compressed)?;

    // IEND chunk
    write_png_chunk(&mut file, b"IEND", &[])?;

    Ok(())
}

#[cfg(target_os = "windows")]
fn write_png_chunk(
    file: &mut std::fs::File,
    chunk_type: &[u8; 4],
    data: &[u8],
) -> Result<(), AppError> {
    let len = data.len() as u32;
    file.write_all(&len.to_be_bytes())
        .map_err(map_png_write_error)?;
    file.write_all(chunk_type)
        .map_err(map_png_write_error)?;
    file.write_all(data)
        .map_err(map_png_write_error)?;

    let mut crc_input = Vec::with_capacity(4 + data.len());
    crc_input.extend_from_slice(chunk_type);
    crc_input.extend_from_slice(data);
    let crc = png_crc32(&crc_input);
    file.write_all(&crc.to_be_bytes())
        .map_err(map_png_write_error)?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn map_png_write_error(e: std::io::Error) -> AppError {
    AppError::new(
        ErrorCode::InternalError,
        format!("Failed to write PNG: {e}"),
        false,
    )
}

#[cfg(target_os = "windows")]
fn png_crc32(data: &[u8]) -> u32 {
    let mut crc: u32 = 0xFFFFFFFF;
    for &byte in data {
        crc ^= byte as u32;
        for _ in 0..8 {
            if crc & 1 != 0 {
                crc = (crc >> 1) ^ 0xEDB88320;
            } else {
                crc >>= 1;
            }
        }
    }
    crc ^ 0xFFFFFFFF
}

#[cfg(target_os = "windows")]
fn deflate_zlib(data: &[u8]) -> Vec<u8> {
    // Use miniz_oxide which is available as a transitive dep (through flate2/reqwest)
    // Alternatively, implement a simple store-only zlib wrapper (no compression)
    // Store-only is simpler and sufficient for screen captures that will be sent to OCR
    let mut output = Vec::new();

    // zlib header: CM=8, CINFO=7, FCHECK so header % 31 == 0
    output.push(0x78);
    output.push(0x01); // no compression level

    // Split data into DEFLATE stored blocks (max 65535 bytes each)
    let chunks: Vec<&[u8]> = data.chunks(65535).collect();
    for (i, chunk) in chunks.iter().enumerate() {
        let is_last = i == chunks.len() - 1;
        output.push(if is_last { 0x01 } else { 0x00 }); // BFINAL + BTYPE=00 (stored)
        let len = chunk.len() as u16;
        let nlen = !len;
        output.extend_from_slice(&len.to_le_bytes());
        output.extend_from_slice(&nlen.to_le_bytes());
        output.extend_from_slice(chunk);
    }

    // Adler-32 checksum
    let adler = adler32(data);
    output.extend_from_slice(&adler.to_be_bytes());

    output
}

#[cfg(target_os = "windows")]
fn adler32(data: &[u8]) -> u32 {
    let mut a: u32 = 1;
    let mut b: u32 = 0;
    for &byte in data {
        a = (a + byte as u32) % 65521;
        b = (b + a) % 65521;
    }
    (b << 16) | a
}
```

**Step 4: Run tests to verify they pass**

Run: `cd src-tauri && cargo test --lib platform::windows_capture::tests -- --nocapture`
Expected: Both tests PASS

**Step 5: Commit**

```bash
git add src-tauri/src/platform/windows_capture.rs
git commit -m "feat(win): add native Win32 GDI screen capture via BitBlt"
```

---

### Task 3: Switch `capture_region_image` to use native capture

**Files:**
- Modify: `src-tauri/src/platform/windows_capture.rs` (the `capture_region_image` function)

**Step 1: Replace PowerShell-based `capture_region_image` with native implementation**

In `src-tauri/src/platform/windows_capture.rs`, replace the existing `capture_region_image` function:

```rust
#[cfg(target_os = "windows")]
pub fn capture_region_image(output_path: &Path, capture_rect: &CaptureRect) -> Result<(), AppError> {
    let rect = normalize_capture_rect(capture_rect)?;
    native_capture_region(output_path, &rect)
}
```

This replaces the old version that spawned PowerShell with `build_region_capture_script`.

**Step 2: Run existing integration test to verify it still works**

Run: `cd src-tauri && cargo test --test windows_capture_script region_capture_script -- --nocapture`

Note: The old integration test `region_capture_script_uses_copy_from_screen` tests the PowerShell script string, which is no longer used by `capture_region_image`. It still tests the `build_region_capture_script` utility function which remains available. The test should still pass since we kept `build_region_capture_script`.

Expected: PASS (the function `build_region_capture_script` is still exported and unchanged)

**Step 3: Run the new unit test again to confirm**

Run: `cd src-tauri && cargo test --lib platform::windows_capture::tests -- --nocapture`
Expected: PASS

**Step 4: Commit**

```bash
git add src-tauri/src/platform/windows_capture.rs
git commit -m "feat(win): switch region capture from PowerShell to native Win32 API"
```

---

### Task 4: Use `ocr_translate_region` for one-step OCR+translate in ScreenshotOverlayApp

**Files:**
- Modify: `frontend/src/features/screenshot/ScreenshotOverlayApp.tsx`

This is the biggest frontend optimization. Currently the `ocr_translate` mode does:
1. `triggerOcrRecognizeRegion` → get OCR text
2. `triggerInputTranslate` → translate the OCR text
3. Merge results manually

The Rust backend already has `ocr_translate_region` that does both in one call. We switch to it.

**Step 1: Update imports**

In `ScreenshotOverlayApp.tsx`, change the import from `taskService`:

```typescript
import {
  triggerOcrRecognizeRegion,
  triggerOcrTranslateRegion,
} from '../task/taskService';
```

Remove the `triggerInputTranslate` import (it was already not directly imported here — it's called via `buildOcrTranslatePayload`).

**Step 2: Rewrite `submitSelection` to use a single backend call per mode**

Replace the entire `submitSelection` function and the `buildOcrTranslatePayload` helper and the `mergeOcrTranslateResult` helper with:

```typescript
  async function submitSelection(nextSelection: DragState) {
    if (!payload) {
      return;
    }

    const captureRect = buildPhysicalCaptureRect(nextSelection, payload.monitor, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    if (captureRect.width <= 0 || captureRect.height <= 0) {
      return;
    }

    await hideOverlayForCapture();

    const baseState: TaskState = initialTaskState;

    if (payload.mode === 'ocr_translate') {
      const direction = {
        sourceLanguageCode: payload.sourceLangHint ?? 'auto',
        sourceLanguageLabel: payload.sourceLanguageLabel,
        targetLanguageCode: payload.targetLanguageCode,
        targetLanguageLabel: payload.targetLanguageLabel,
      };
      const targetLang = payload.targetLang ?? payload.targetLanguageCode;
      const next = await triggerOcrTranslateRegion(
        baseState,
        captureRect,
        targetLang,
        undefined,
        payload.sourceLangHint,
      );

      if (next.action === 'succeeded' && next.payload.result) {
        const resultPayload = createOcrTranslatePayload(next.payload.result, direction);
        clearCachedScreenshotOverlayPayload();
        setPayload(null);
        setIsSubmitting(false);
        await showOcrResultWindow(resultPayload);
        return;
      }
      if (next.action !== 'cancelled') {
        const message = next.payload.error?.message ?? '截图翻译失败';
        clearCachedScreenshotOverlayPayload();
        setPayload(null);
        setErrorMessage('');
        setIsSubmitting(false);
        showCaptureFailure(message);
        return;
      }
      clearCachedScreenshotOverlayPayload();
      setPayload(null);
      setIsSubmitting(false);
      return;
    }

    // ocr_recognize mode
    const next = await triggerOcrRecognizeRegion(baseState, captureRect, payload.sourceLangHint);

    if (next.action === 'succeeded' && next.payload.result) {
      const resultPayload = createOcrRecognizePayload(next.payload.result, {
        sourceLanguageCode: payload.sourceLangHint ?? 'auto',
        sourceLanguageLabel: payload.sourceLanguageLabel,
        targetLanguageCode: payload.targetLanguageCode,
        targetLanguageLabel: payload.targetLanguageLabel,
      });
      clearCachedScreenshotOverlayPayload();
      setPayload(null);
      setIsSubmitting(false);
      await showOcrResultWindow(resultPayload);
      return;
    }

    if (next.action !== 'cancelled') {
      const message = next.payload.error?.message ?? '截图识别失败';
      clearCachedScreenshotOverlayPayload();
      setPayload(null);
      setErrorMessage('');
      setIsSubmitting(false);
      showCaptureFailure(message);
    } else {
      clearCachedScreenshotOverlayPayload();
      setPayload(null);
      setIsSubmitting(false);
    }
  }
```

**Step 3: Remove dead code**

Remove these three functions that are no longer needed:
- `mergeOcrTranslateResult`
- `buildOcrTranslatePayload`

Remove these unused imports:
- `triggerInputTranslate` (from `../task/taskService`)
- `resolveOcrTranslateDirection` (from `../ocr/ocrTranslateDirection`)

The final imports at the top of the file should be:

```typescript
import { useEffect, useRef, useState } from 'react';
import { emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  SCREENSHOT_OVERLAY_READY_EVENT,
  SCREENSHOT_OVERLAY_UPDATE_EVENT,
  ScreenshotOverlayPayload,
  clearCachedScreenshotOverlayPayload,
  isScreenshotOverlayPayload,
  readCachedScreenshotOverlayPayload,
} from './screenshotOverlayBridge';
import { buildPhysicalCaptureRect } from './screenshotOverlayGeometry';
import { initialTaskState } from '../task/taskReducer';
import {
  triggerOcrRecognizeRegion,
  triggerOcrTranslateRegion,
} from '../task/taskService';
import {
  createOcrRecognizePayload,
  createOcrTranslatePayload,
} from '../ocr/translationWorkspacePayload';
import { showOcrResultWindow } from '../ocr/ocrResultWindowService';
import { TaskState } from '../task/taskTypes';
```

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 5: Run existing tests**

Run: `cd frontend && npx vitest run src/tests/features/ScreenshotOverlayApp.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add frontend/src/features/screenshot/ScreenshotOverlayApp.tsx
git commit -m "perf(win): use single ocr_translate_region call instead of two-step OCR+translate"
```

---

### Task 5: Parallelize monitor resolution and window creation in screenshotOverlayService

**Files:**
- Modify: `frontend/src/features/screenshot/screenshotOverlayService.ts`

**Step 1: Rewrite `showScreenshotOverlay` with `Promise.all`**

Replace the `showScreenshotOverlay` function:

```typescript
export async function showScreenshotOverlay(request: ScreenshotOverlayRequest) {
  if (!isTauriRuntime()) {
    return;
  }

  const [monitor, overlayWindow] = await Promise.all([
    resolveActiveMonitor(),
    ensureScreenshotOverlayWindow(),
  ]);

  const payload: ScreenshotOverlayPayload = {
    ...request,
    monitor: {
      x: monitor.position.x,
      y: monitor.position.y,
      width: monitor.size.width,
      height: monitor.size.height,
      scaleFactor: monitor.scaleFactor,
    },
  };
  cacheScreenshotOverlayPayload(payload);

  await positionScreenshotOverlayWindow(overlayWindow, monitor);
  await overlayWindow.show();
  await overlayWindow.setFocus();
  await waitForOverlayReady();
  await emitOverlayPayload(payload);
  await new Promise((resolve) => window.setTimeout(resolve, OVERLAY_PAYLOAD_RETRY_DELAY_MS));
  await emitOverlayPayload(payload);
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/features/screenshot/screenshotOverlayService.ts
git commit -m "perf: parallelize monitor resolution and overlay window creation"
```

---

### Task 6: Pre-create overlay and result windows at startup

**Files:**
- Modify: `frontend/src/features/screenshot/screenshotOverlayService.ts`
- Modify: `frontend/src/features/ocr/ocrResultWindowService.ts`

**Step 1: Enhance `primeScreenshotOverlayService` to pre-create the window**

In `screenshotOverlayService.ts`, replace the `primeScreenshotOverlayService` function:

```typescript
export async function primeScreenshotOverlayService() {
  await bindOverlayReadyListener();
  await ensureScreenshotOverlayWindow();
}
```

**Step 2: Add and export `primeOcrResultWindowService` in ocrResultWindowService.ts**

At the bottom of `ocrResultWindowService.ts`, add:

```typescript
export async function primeOcrResultWindowService() {
  if (!isTauriRuntime()) {
    return;
  }
  await ensureOcrResultWindow();
}
```

**Step 3: Call it from App.tsx startup**

In `frontend/src/app/App.tsx`, add the import:

```typescript
import { primeOcrResultWindowService } from '../features/ocr/ocrResultWindowService';
```

Then update the existing `useEffect` that calls `primeScreenshotOverlayService` (around line 366-373):

```typescript
  useEffect(() => {
    if (!isWindowsTauriRuntime()) {
      return;
    }

    void primeScreenshotOverlayService().catch((error) => {
      console.error('screenshot overlay service init failed', error);
    });
    void primeOcrResultWindowService().catch((error) => {
      console.error('ocr result window service init failed', error);
    });
  }, []);
```

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add frontend/src/features/screenshot/screenshotOverlayService.ts
git add frontend/src/features/ocr/ocrResultWindowService.ts
git add frontend/src/app/App.tsx
git commit -m "perf: pre-create overlay and OCR result windows at startup"
```

---

### Task 7: Use `WDA_EXCLUDEFROMCAPTURE` to eliminate overlay hide delay

**Files:**
- Create: `src-tauri/src/platform/windows_window.rs`
- Modify: `src-tauri/src/platform/mod.rs`
- Create: `frontend/src/features/screenshot/screenshotOverlayExclude.ts`
- Modify: `frontend/src/features/screenshot/ScreenshotOverlayApp.tsx`

This optimization uses `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)` (Windows 10 2004+) to make the overlay window invisible to screen capture, so we can capture without hiding and waiting.

**Step 1: Add a Tauri command to set display affinity**

Create `src-tauri/src/platform/windows_window.rs`:

```rust
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::HWND;
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::SetWindowDisplayAffinity;

/// WDA_EXCLUDEFROMCAPTURE = 0x00000011 (available since Windows 10 version 2004)
#[cfg(target_os = "windows")]
const WDA_EXCLUDEFROMCAPTURE: u32 = 0x00000011;

#[cfg(target_os = "windows")]
pub fn exclude_window_from_capture(hwnd_raw: isize) -> Result<(), String> {
    unsafe {
        let hwnd = HWND(hwnd_raw as *mut _);
        SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)
            .map_err(|e| format!("SetWindowDisplayAffinity failed: {e}"))
    }
}
```

**Step 2: Update `platform/mod.rs`**

```rust
pub mod capture;
#[cfg(target_os = "windows")]
pub mod windows_capture;
#[cfg(target_os = "windows")]
pub mod windows_window;
```

**Step 3: Add a Tauri command**

Create `src-tauri/src/commands/window_display.rs`:

```rust
#[cfg(target_os = "windows")]
use crate::platform::windows_window::exclude_window_from_capture;

#[tauri::command]
pub async fn set_capture_excluded(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let hwnd = window.hwnd().map_err(|e| format!("Failed to get HWND: {e}"))?;
        exclude_window_from_capture(hwnd.0 as isize)?;
    }
    Ok(())
}
```

**Step 4: Register the command**

In `src-tauri/src/commands/mod.rs`, add:

```rust
pub mod window_display;
```

In `src-tauri/src/lib.rs`, add `commands::window_display::set_capture_excluded` to both `invoke_handler` blocks (the `#[cfg(test)]` and `#[cfg(not(test))]` blocks).

**Step 5: Run cargo check**

Run: `cd src-tauri && cargo check`
Expected: No errors

**Step 6: Add frontend bridge function**

Create `frontend/src/features/screenshot/screenshotOverlayExclude.ts`:

```typescript
import { invoke } from '@tauri-apps/api/core';

let excluded = false;

export async function ensureCaptureExcluded(): Promise<void> {
  if (excluded) {
    return;
  }
  try {
    await invoke('set_capture_excluded');
    excluded = true;
  } catch (error) {
    console.warn('Failed to set capture exclusion (requires Windows 10 2004+):', error);
  }
}
```

**Step 7: Use it in ScreenshotOverlayApp and remove hide delay**

In `ScreenshotOverlayApp.tsx`, add the import:

```typescript
import { ensureCaptureExcluded } from './screenshotOverlayExclude';
```

Replace the `hideOverlayForCapture` function with a simpler version:

```typescript
  async function prepareForCapture() {
    draggingRef.current = false;
    setErrorMessage('');
    setSelection(null);
    setIsSubmitting(true);
    await ensureCaptureExcluded();
  }
```

Update `submitSelection` to call `prepareForCapture()` instead of `hideOverlayForCapture()`:

Change:
```typescript
    await hideOverlayForCapture();
```
To:
```typescript
    await prepareForCapture();
```

Also remove the now-unused `delayWindowHide` and `waitForNextPaint` functions, and the `OVERLAY_HIDE_SETTLE_MS` constant.

The overlay no longer needs to be hidden before capture because `WDA_EXCLUDEFROMCAPTURE` makes it invisible to the capture API.

After capture completes (success or failure), we still hide the overlay via `closeOverlay(true)` as before in the success/failure branches — the existing `clearCachedScreenshotOverlayPayload(); setPayload(null);` flow already handles returning to null state which renders nothing.

**Step 8: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 9: Run tests**

Run: `cd frontend && npx vitest run src/tests/features/ScreenshotOverlayApp.test.tsx`
Expected: PASS

**Step 10: Commit**

```bash
git add src-tauri/src/platform/windows_window.rs
git add src-tauri/src/platform/mod.rs
git add src-tauri/src/commands/window_display.rs
git add src-tauri/src/commands/mod.rs
git add src-tauri/src/lib.rs
git add frontend/src/features/screenshot/screenshotOverlayExclude.ts
git add frontend/src/features/screenshot/ScreenshotOverlayApp.tsx
git commit -m "perf(win): use WDA_EXCLUDEFROMCAPTURE to skip overlay hide delay"
```

---

### Task 8: Final integration verification

**Step 1: Run full quality check**

Run: `npm run check`
Expected: All typecheck + lint + tests pass

**Step 2: Run format**

Run: `npm run format`
Expected: Files formatted

**Step 3: Run format check**

Run: `npm run format:check`
Expected: All clean

**Step 4: Build the app**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Final commit (if format changed anything)**

```bash
git add -A
git commit -m "chore: format after windows OCR pipeline optimization"
```
