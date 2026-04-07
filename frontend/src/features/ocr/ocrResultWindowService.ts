import { emitTo } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
  LogicalSize,
  PhysicalPosition,
  currentMonitor,
  cursorPosition,
  monitorFromPoint,
  type Monitor,
} from '@tauri-apps/api/window';
import { CaptureRect } from '../task/taskTypes';
import { loadSettingsFromStorage } from '../settings/settingsStorage';
import { OcrPanelPosition } from '../settings/settingsTypes';
import {
  OCR_RESULT_UPDATE_EVENT,
  OCR_RESULT_WINDOW_LABEL,
  OCR_RESULT_WINDOW_QUERY,
  OcrResultWindowPayload,
  cacheOcrResultPayload,
  readCachedOcrResultPayload,
} from './ocrResultWindowBridge';

const OCR_WINDOW_WIDTH = 460;
const OCR_WINDOW_HEIGHT = 560;
const OCR_WINDOW_MIN_WIDTH = 360;
const OCR_WINDOW_MIN_HEIGHT = 320;
const SCREEN_MARGIN = 16;

type PositionPoint = {
  x: number;
  y: number;
};

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

async function waitUntilWindowCreated(target: WebviewWindow): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false;

    const markDone = (next: () => void) => {
      if (done) {
        return;
      }
      done = true;
      next();
    };

    target
      .once('tauri://created', () => markDone(resolve))
      .catch((error) => markDone(() => reject(error)));
    target
      .once('tauri://error', (event) => {
        markDone(() => reject(new Error(String(event.payload))));
      })
      .catch((error) => markDone(() => reject(error)));
  });
}

async function createOcrResultWindow() {
  const createdWindow = new WebviewWindow(OCR_RESULT_WINDOW_LABEL, {
    url: OCR_RESULT_WINDOW_QUERY,
    title: 'OCR 结果',
    width: OCR_WINDOW_WIDTH,
    height: OCR_WINDOW_HEIGHT,
    minWidth: OCR_WINDOW_MIN_WIDTH,
    minHeight: OCR_WINDOW_MIN_HEIGHT,
    resizable: true,
    transparent: true,
    alwaysOnTop: true,
    visible: false,
    focus: false,
    skipTaskbar: true,
    hiddenTitle: true,
    titleBarStyle: 'overlay',
  });
  await waitUntilWindowCreated(createdWindow);
  return createdWindow;
}

async function ensureOcrResultWindow() {
  console.log('[ensureOcrResultWindow] checking for existing window...');
  const existing = await WebviewWindow.getByLabel(OCR_RESULT_WINDOW_LABEL);
  if (existing) {
    console.log('[ensureOcrResultWindow] found existing window');
    return existing;
  }
  console.log('[ensureOcrResultWindow] creating new window...');
  const newWindow = await createOcrResultWindow();
  console.log('[ensureOcrResultWindow] window created successfully');
  return newWindow;
}

async function resolveActiveMonitor(): Promise<Monitor> {
  const cursor = await cursorPosition();
  const matched = await monitorFromPoint(cursor.x, cursor.y);
  if (matched) {
    return matched;
  }
  const current = await currentMonitor();
  if (current) {
    return current;
  }
  throw new Error('无法获取当前屏幕信息');
}

async function positionOcrResultWindow(
  target: WebviewWindow,
  _captureRect: CaptureRect | null | undefined,
) {
  await target.setSize(new LogicalSize(OCR_WINDOW_WIDTH, OCR_WINDOW_HEIGHT));

  const [monitor, windowSize] = await Promise.all([resolveActiveMonitor(), target.outerSize()]);
  const point = calculatePinnedPosition(
    loadSettingsFromStorage().ocrPanelPosition,
    monitor,
    windowSize.width,
    windowSize.height,
  );
  await target.setPosition(new PhysicalPosition(Math.round(point.x), Math.round(point.y)));
}

function calculatePinnedPosition(
  panelPosition: OcrPanelPosition,
  monitor: Monitor,
  windowWidth: number,
  windowHeight: number,
): PositionPoint {
  const workArea = monitor.workArea;
  const minX = workArea.position.x + SCREEN_MARGIN;
  const minY = workArea.position.y + SCREEN_MARGIN;
  const maxX = Math.max(
    minX,
    workArea.position.x + workArea.size.width - windowWidth - SCREEN_MARGIN,
  );
  const maxY = Math.max(
    minY,
    workArea.position.y + workArea.size.height - windowHeight - SCREEN_MARGIN,
  );
  if (panelPosition === 'top_left') {
    return { x: clamp(minX, minX, maxX), y: clamp(minY, minY, maxY) };
  }
  if (panelPosition === 'center') {
    return {
      x: clamp(workArea.position.x + (workArea.size.width - windowWidth) / 2, minX, maxX),
      y: clamp(workArea.position.y + (workArea.size.height - windowHeight) / 2, minY, maxY),
    };
  }
  return { x: clamp(maxX, minX, maxX), y: clamp(minY, minY, maxY) };
}

async function emitResultPayload(payload: OcrResultWindowPayload) {
  await emitTo(OCR_RESULT_WINDOW_LABEL, OCR_RESULT_UPDATE_EVENT, payload);
}

async function showAndFocusOcrWindow(
  ocrWindow: WebviewWindow,
  captureRect: CaptureRect | null | undefined,
) {
  await positionOcrResultWindow(ocrWindow, captureRect);
  await ocrWindow.show();
  await ocrWindow.setFocus();
}

export async function showOcrResultWindow(payload: OcrResultWindowPayload) {
  if (!isTauriRuntime()) {
    console.log('[showOcrResultWindow] not in Tauri runtime, skipping');
    return;
  }
  console.log('[showOcrResultWindow] starting...');
  cacheOcrResultPayload(payload);
  console.log('[showOcrResultWindow] payload cached');

  const ocrWindow = await ensureOcrResultWindow();
  console.log('[showOcrResultWindow] window ensured');

  await showAndFocusOcrWindow(ocrWindow, payload.result?.captureRect);
  console.log('[showOcrResultWindow] window shown and focused');

  await emitResultPayload(payload);
  console.log('[showOcrResultWindow] payload emitted');
}

export async function showCachedOcrResultWindow() {
  if (!isTauriRuntime()) {
    return;
  }
  const payload = readCachedOcrResultPayload();
  const ocrWindow = await ensureOcrResultWindow();
  await showAndFocusOcrWindow(ocrWindow, payload?.result?.captureRect);
  if (payload) {
    await emitResultPayload(payload);
  }
}

export async function primeOcrResultWindowService() {
  if (!isTauriRuntime()) {
    return;
  }
  await ensureOcrResultWindow();
}
