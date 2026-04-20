import { useEffect, useMemo, useRef, useState } from 'react';
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
import { triggerOcrRecognizeRegion } from '../task/taskService';
import {
  createOcrRecognizePayload,
  createOcrTranslatePayload,
  createErrorPayload,
  createPendingPayload,
} from '../ocr/translationWorkspacePayload';
import { showOcrResultWindow, updateOcrResultWindow } from '../ocr/ocrResultWindowService';
import { ensureCaptureExcluded } from './screenshotOverlayExclude';
import { TaskState } from '../task/taskTypes';
import {
  buildEnabledOcrProviderConfigs,
  resolveOcrProviderRequestId,
} from '../settings/ocrProviderRequest';
import { loadSettingsForTranslation } from '../settings/nativeSettingsStorage';
import { isTauriRuntime } from '../../app/appRuntime';

type DragState = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

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

export function ScreenshotOverlayApp() {
  const [payload, setPayload] = useState<ScreenshotOverlayPayload | null>(() =>
    readCachedScreenshotOverlayPayload(),
  );
  const [selection, setSelection] = useState<DragState | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const draggingRef = useRef(false);
  const selectionRef = useRef<DragState | null>(null);
  const settingsPromiseRef = useRef<null | ReturnType<typeof loadSettingsForTranslation>>(null);

  useEffect(() => {
    if (!payload) {
      settingsPromiseRef.current = null;
      return;
    }
    settingsPromiseRef.current = loadSettingsForTranslation();
    void ensureCaptureExcluded();
  }, [payload]);

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
    selectionRef.current = null;
    setIsSubmitting(false);
    draggingRef.current = false;
    await getCurrentWindow().hide();
  }

  async function hideOverlayForCapture() {
    draggingRef.current = false;
    setErrorMessage('');
    setSelection(null);
    selectionRef.current = null;
    setIsSubmitting(true);
    await ensureCaptureExcluded();
    await getCurrentWindow().hide();
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

    const settingsPromise = settingsPromiseRef.current ?? loadSettingsForTranslation();
    settingsPromiseRef.current = null;
    const [settings] = await Promise.all([settingsPromise, hideOverlayForCapture()]);

    const direction = {
      sourceLanguageCode: payload.sourceLangHint ?? 'auto',
      sourceLanguageLabel: payload.sourceLanguageLabel,
      targetLanguageCode: payload.targetLanguageCode,
      targetLanguageLabel: payload.targetLanguageLabel,
    };

    const baseState: TaskState = initialTaskState;

    if (payload.mode === 'ocr_translate') {
      const pendingOcrPayload = createPendingPayload(
        'ocr_translate',
        direction,
        '正在识别...',
        settings.defaultTranslateProvider,
      );
      const [next] = await Promise.all([
        triggerOcrRecognizeRegion(
          baseState,
          captureRect,
          payload.sourceLangHint,
          resolveOcrProviderRequestId(settings.defaultOcrProvider),
          buildEnabledOcrProviderConfigs(settings.providers),
        ),
        showOcrResultWindow(pendingOcrPayload),
      ]);

      clearCachedScreenshotOverlayPayload();
      setPayload(null);
      setIsSubmitting(false);

      if (next.action === 'succeeded' && next.payload.result) {
        await updateOcrResultWindow(
          createOcrTranslatePayload(
            next.payload.result,
            direction,
            true,
            settings.defaultTranslateProvider,
          ),
        );
        return;
      }
      if (next.action !== 'cancelled') {
        await updateOcrResultWindow(
          createErrorPayload(
            'ocr_translate',
            next.payload.error?.message ?? '截图识别失败',
            direction,
            settings.defaultTranslateProvider,
          ),
        );
      }
      return;
    }

    // ocr_recognize mode
    const pendingOcrPayload = createPendingPayload(
      'ocr_recognize',
      direction,
      '正在识别...',
      settings.defaultTranslateProvider,
    );
    const [next] = await Promise.all([
      triggerOcrRecognizeRegion(
        baseState,
        captureRect,
        payload.sourceLangHint,
        resolveOcrProviderRequestId(settings.defaultOcrProvider),
        buildEnabledOcrProviderConfigs(settings.providers),
      ),
      showOcrResultWindow(pendingOcrPayload),
    ]);

    clearCachedScreenshotOverlayPayload();
    setPayload(null);
    setIsSubmitting(false);

    if (next.action === 'succeeded' && next.payload.result) {
      await updateOcrResultWindow(
        createOcrRecognizePayload(
          next.payload.result,
          direction,
          settings.autoQueryOnOcr,
          settings.defaultTranslateProvider,
        ),
      );
      return;
    }
    if (next.action !== 'cancelled') {
      await updateOcrResultWindow(
        createErrorPayload(
          'ocr_recognize',
          next.payload.error?.message ?? '截图识别失败',
          direction,
          settings.defaultTranslateProvider,
        ),
      );
    }
  }

  const selectionStyle = useMemo(() => buildSelectionStyle(selection), [selection]);

  if (!payload) {
    return null;
  }

  return (
    <main
      className={
        isSubmitting ? 'screenshotOverlayRoot screenshotOverlayRootHidden' : 'screenshotOverlayRoot'
      }
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => {
        if (isSubmitting) {
          return;
        }
        draggingRef.current = true;
        setErrorMessage('');
        const nextSelection = {
          startX: event.clientX,
          startY: event.clientY,
          endX: event.clientX,
          endY: event.clientY,
        };
        selectionRef.current = nextSelection;
        setSelection(nextSelection);
      }}
      onMouseMove={(event) => {
        if (!draggingRef.current || isSubmitting) {
          return;
        }
        const current = selectionRef.current;
        if (!current) {
          return;
        }
        const nextSelection = {
          ...current,
          endX: event.clientX,
          endY: event.clientY,
        };
        selectionRef.current = nextSelection;
        setSelection(nextSelection);
      }}
      onMouseUp={async (event) => {
        const currentSelection = selectionRef.current;
        if (!draggingRef.current || !currentSelection || isSubmitting) {
          return;
        }
        draggingRef.current = false;
        const nextSelection = {
          ...currentSelection,
          endX: event.clientX,
          endY: event.clientY,
        };
        selectionRef.current = nextSelection;
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
