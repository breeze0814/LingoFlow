type RecordObject = Record<string, unknown>;

export const SCREENSHOT_OVERLAY_WINDOW_LABEL = 'screenshot_overlay';
export const SCREENSHOT_OVERLAY_WINDOW_QUERY = '/?window=screenshot_overlay';
export const SCREENSHOT_OVERLAY_UPDATE_EVENT = 'screenshot://overlay/update';
export const SCREENSHOT_OVERLAY_READY_EVENT = 'screenshot://overlay/ready';

const SCREENSHOT_OVERLAY_CACHE_KEY = 'lingoflow.screenshot.overlay.v1';

export type ScreenshotOverlayMode = 'ocr_recognize' | 'ocr_translate';

export type ScreenshotOverlayMonitor = {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
};

export type ScreenshotOverlayPayload = {
  mode: ScreenshotOverlayMode;
  sourceLanguageLabel: string;
  sourceLangHint?: string;
  targetLanguageCode: string;
  targetLanguageLabel: string;
  targetLang?: string;
  monitor: ScreenshotOverlayMonitor;
};

function isRecordObject(value: unknown): value is RecordObject {
  return typeof value === 'object' && value !== null;
}

function isMonitor(value: unknown): value is ScreenshotOverlayMonitor {
  if (!isRecordObject(value)) {
    return false;
  }
  return (
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.width === 'number' &&
    typeof value.height === 'number' &&
    typeof value.scaleFactor === 'number'
  );
}

export function isScreenshotOverlayPayload(value: unknown): value is ScreenshotOverlayPayload {
  if (!isRecordObject(value)) {
    return false;
  }

  return (
    (value.mode === 'ocr_recognize' || value.mode === 'ocr_translate') &&
    typeof value.sourceLanguageLabel === 'string' &&
    typeof value.targetLanguageCode === 'string' &&
    typeof value.targetLanguageLabel === 'string' &&
    (value.sourceLangHint === undefined || typeof value.sourceLangHint === 'string') &&
    (value.targetLang === undefined || typeof value.targetLang === 'string') &&
    isMonitor(value.monitor)
  );
}

export function cacheScreenshotOverlayPayload(payload: ScreenshotOverlayPayload) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(SCREENSHOT_OVERLAY_CACHE_KEY, JSON.stringify(payload));
}

export function clearCachedScreenshotOverlayPayload() {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(SCREENSHOT_OVERLAY_CACHE_KEY);
}

export function readCachedScreenshotOverlayPayload(): ScreenshotOverlayPayload | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(SCREENSHOT_OVERLAY_CACHE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return isScreenshotOverlayPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
