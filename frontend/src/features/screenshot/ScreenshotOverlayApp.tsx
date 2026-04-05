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

type DragState = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function buildSelectionStyle(selection: DragState | null) {
  if (!selection) {
    return { display: 'none' };
  }

  const left = Math.min(selection.startX, selection.endX);
  const top = Math.min(selection.startY, selection.endY);
  const width = Math.abs(selection.endX - selection.startX);
  const height = Math.abs(selection.endY - selection.startY);

  return {
    left,
    top,
    width,
    height,
  };
}

function showCaptureFailure(message: string) {
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(message);
  }
}

export function ScreenshotOverlayApp() {
  const [payload, setPayload] = useState<ScreenshotOverlayPayload | null>(
    () => readCachedScreenshotOverlayPayload(),
  );
  const [selection, setSelection] = useState<DragState | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let cleanup: null | (() => void) = null;
    let disposed = false;

    async function bindOverlayListener() {
      const currentWindow = getCurrentWindow();
      const unlisten = await currentWindow.listen<ScreenshotOverlayPayload>(
        SCREENSHOT_OVERLAY_UPDATE_EVENT,
        (event) => {
          if (!isScreenshotOverlayPayload(event.payload)) {
            return;
          }
          setErrorMessage('');
          setSelection(null);
          setIsSubmitting(false);
          setPayload(event.payload);
        },
      );
      await emit(SCREENSHOT_OVERLAY_READY_EVENT, { ready: true });
      if (disposed) {
        unlisten();
        return;
      }
      cleanup = unlisten;
    }

    void bindOverlayListener();
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    if (!payload) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      void closeOverlay(true);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [payload]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    const syncCachedPayload = () => {
      const cached = readCachedScreenshotOverlayPayload();
      if (!cached) {
        return;
      }
      setPayload(cached);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      syncCachedPayload();
    };

    window.addEventListener('focus', syncCachedPayload);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', syncCachedPayload);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  async function closeOverlay(clearCache: boolean) {
    if (clearCache) {
      clearCachedScreenshotOverlayPayload();
      setPayload(null);
    }
    setSelection(null);
    setIsSubmitting(false);
    draggingRef.current = false;
    await getCurrentWindow().hide();
  }

  async function hideOverlayForCapture() {
    draggingRef.current = false;
    setErrorMessage('');
    setSelection(null);
    setIsSubmitting(true);
  }

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

  if (!payload) {
    return null;
  }

  const selectionStyle = buildSelectionStyle(selection);

  return (
    <main
      className={isSubmitting ? 'screenshotOverlayRoot screenshotOverlayRootHidden' : 'screenshotOverlayRoot'}
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => {
        if (isSubmitting) {
          return;
        }
        draggingRef.current = true;
        setErrorMessage('');
        setSelection({
          startX: event.clientX,
          startY: event.clientY,
          endX: event.clientX,
          endY: event.clientY,
        });
      }}
      onMouseMove={(event) => {
        if (!draggingRef.current || isSubmitting) {
          return;
        }
        setSelection((current) =>
          current
            ? {
                ...current,
                endX: event.clientX,
                endY: event.clientY,
              }
            : current,
        );
      }}
      onMouseUp={async (event) => {
        if (!draggingRef.current || !selection || isSubmitting) {
          return;
        }
        draggingRef.current = false;
        const nextSelection = {
          ...selection,
          endX: event.clientX,
          endY: event.clientY,
        };
        setSelection(nextSelection);
        await submitSelection(nextSelection);
      }}
    >
      <div className="screenshotOverlayHint">
        <strong>{payload.mode === 'ocr_translate' ? '截图翻译' : '截图识别'}</strong>
        <span>拖拽选择区域，按 Esc 取消</span>
        {errorMessage ? <em>{errorMessage}</em> : null}
      </div>
      <div className="screenshotOverlaySelection" style={selectionStyle} />
    </main>
  );
}
