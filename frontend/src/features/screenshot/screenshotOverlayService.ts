import { emitTo, listen } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
  LogicalSize,
  PhysicalPosition,
  currentMonitor,
  cursorPosition,
  monitorFromPoint,
  type Monitor,
} from '@tauri-apps/api/window';
import {
  SCREENSHOT_OVERLAY_READY_EVENT,
  SCREENSHOT_OVERLAY_UPDATE_EVENT,
  SCREENSHOT_OVERLAY_WINDOW_LABEL,
  SCREENSHOT_OVERLAY_WINDOW_QUERY,
  ScreenshotOverlayPayload,
  cacheScreenshotOverlayPayload,
} from './screenshotOverlayBridge';

type ScreenshotOverlayRequest = Omit<ScreenshotOverlayPayload, 'monitor'>;

const OVERLAY_READY_TIMEOUT_MS = 1500;
const OVERLAY_PAYLOAD_RETRY_DELAY_MS = 32;

let overlayReady = false;
let overlayListenerPromise: Promise<void> | null = null;
const overlayReadyWaiters: Array<() => void> = [];

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
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

async function createScreenshotOverlayWindow() {
  overlayReady = false;
  const createdWindow = new WebviewWindow(SCREENSHOT_OVERLAY_WINDOW_LABEL, {
    url: SCREENSHOT_OVERLAY_WINDOW_QUERY,
    title: '截图选区',
    transparent: true,
    decorations: false,
    alwaysOnTop: true,
    visible: false,
    focus: true,
    skipTaskbar: true,
    resizable: false,
  });
  await waitUntilWindowCreated(createdWindow);
  return createdWindow;
}

async function ensureScreenshotOverlayWindow() {
  const existing = await WebviewWindow.getByLabel(SCREENSHOT_OVERLAY_WINDOW_LABEL);
  if (existing) {
    return existing;
  }
  return createScreenshotOverlayWindow();
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

async function positionScreenshotOverlayWindow(target: WebviewWindow, monitor: Monitor) {
  const logicalWidth = monitor.size.width / monitor.scaleFactor;
  const logicalHeight = monitor.size.height / monitor.scaleFactor;

  await target.setSize(new LogicalSize(logicalWidth, logicalHeight));
  await target.setPosition(
    new PhysicalPosition(Math.round(monitor.position.x), Math.round(monitor.position.y)),
  );
}

async function emitOverlayPayload(payload: ScreenshotOverlayPayload) {
  await emitTo(SCREENSHOT_OVERLAY_WINDOW_LABEL, SCREENSHOT_OVERLAY_UPDATE_EVENT, payload);
}

async function bindOverlayReadyListener() {
  if (overlayListenerPromise || !isTauriRuntime()) {
    return overlayListenerPromise;
  }

  overlayListenerPromise = listen(SCREENSHOT_OVERLAY_READY_EVENT, () => {
    overlayReady = true;
    for (const resolve of overlayReadyWaiters.splice(0)) {
      resolve();
    }
  }).then(() => undefined);

  return overlayListenerPromise;
}

async function waitForOverlayReady() {
  await bindOverlayReadyListener();
  if (overlayReady) {
    return;
  }

  let waiter: (() => void) | null = null;
  await Promise.race([
    new Promise<void>((resolve) => {
      waiter = resolve;
      overlayReadyWaiters.push(resolve);
    }),
    new Promise<void>((resolve) => window.setTimeout(resolve, OVERLAY_READY_TIMEOUT_MS)),
  ]);
  if (!waiter) {
    return;
  }
  const staleWaiterIndex = overlayReadyWaiters.indexOf(waiter);
  if (staleWaiterIndex >= 0) {
    overlayReadyWaiters.splice(staleWaiterIndex, 1);
  }
}

export async function primeScreenshotOverlayService() {
  await bindOverlayReadyListener();
  await ensureScreenshotOverlayWindow();
}

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
