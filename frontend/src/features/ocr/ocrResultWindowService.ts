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
import { isTauriRuntime } from '../../app/appRuntime';

const OCR_WINDOW_WIDTH = 460;
const OCR_WINDOW_HEIGHT = 560;
const OCR_WINDOW_MIN_WIDTH = 360;
const OCR_WINDOW_MIN_HEIGHT = 320;
const SCREEN_MARGIN = 16;

type PositionPoint = {
  x: number;
  y: number;
};

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
  const existing = await WebviewWindow.getByLabel(OCR_RESULT_WINDOW_LABEL);
  if (existing) {
    try {
      await existing.isVisible();
      return existing;
    } catch {
      // Window is damaged, recreate
    }
  }
  return createOcrResultWindow();
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

async function positionOcrResultWindow(target: WebviewWindow) {
  const ocrPanelPosition = loadSettingsFromStorage().ocrPanelPosition;
  const [monitor] = await Promise.all([
    resolveActiveMonitor(),
    target.setSize(new LogicalSize(OCR_WINDOW_WIDTH, OCR_WINDOW_HEIGHT)),
  ]);

  const point = calculatePinnedPosition(
    ocrPanelPosition,
    monitor,
    OCR_WINDOW_WIDTH,
    OCR_WINDOW_HEIGHT,
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

async function showAndFocusOcrWindow(ocrWindow: WebviewWindow) {
  await Promise.all([positionOcrResultWindow(ocrWindow), ocrWindow.show(), ocrWindow.setFocus()]);
}

export async function showOcrResultWindow(payload: OcrResultWindowPayload) {
  if (!isTauriRuntime()) {
    return;
  }
  cacheOcrResultPayload(payload);

  const ocrWindow = await ensureOcrResultWindow();

  await Promise.all([showAndFocusOcrWindow(ocrWindow), emitResultPayload(payload)]);
}

export async function showCachedOcrResultWindow() {
  if (!isTauriRuntime()) {
    return;
  }
  const payload = readCachedOcrResultPayload();
  const ocrWindow = await ensureOcrResultWindow();
  if (payload) {
    await Promise.all([showAndFocusOcrWindow(ocrWindow), emitResultPayload(payload)]);
  } else {
    await showAndFocusOcrWindow(ocrWindow);
  }
}

export async function primeOcrResultWindowService() {
  if (!isTauriRuntime()) {
    return;
  }
  await ensureOcrResultWindow();
}
