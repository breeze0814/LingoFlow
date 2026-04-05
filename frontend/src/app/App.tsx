import { useCallback, useEffect, useRef, useState } from 'react';
import { MainLayout } from './layout/MainLayout';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import { initialTaskState, taskReducer } from '../features/task/taskReducer';
import {
  triggerOcrRecognize,
  triggerOcrTranslate,
  triggerSelectionTranslate,
} from '../features/task/taskService';
import { LANGUAGE_OPTIONS, SettingsState } from '../features/settings/settingsTypes';
import {
  loadSettingsFromStorage,
  saveSettingsToStorage,
} from '../features/settings/settingsStorage';
import { isTrayActionPayload, TRAY_ACTION_EVENT, TrayAction } from '../features/tray/trayEvents';
import { TaskResult, TaskState, TaskType } from '../features/task/taskTypes';
import { matchesShortcut } from '../features/settings/shortcutMatcher';
import { reportTask } from '../features/task/taskReporter';
import {
  showOcrResultWindow,
  primeOcrResultWindowService,
} from '../features/ocr/ocrResultWindowService';
import { OcrResultWindowPayload } from '../features/ocr/ocrResultWindowBridge';
import { syncNativeShortcuts } from '../features/settings/nativeShortcutSyncService';
import {
  createInputTranslatePayload,
  createOcrRecognizePayload,
  createOcrTranslatePayload,
} from '../features/ocr/translationWorkspacePayload';
import {
  primeScreenshotOverlayService,
  showScreenshotOverlay,
} from '../features/screenshot/screenshotOverlayService';

function makeTaskId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `task_${Date.now()}`;
}

function makeUiError(taskType: TaskType, message: string): TaskState {
  return {
    taskId: makeTaskId(),
    taskType,
    status: 'failure',
    result: null,
    error: {
      code: 'ui_error',
      message,
      retryable: true,
    },
  };
}

function languageLabel(code: string): string {
  const found = LANGUAGE_OPTIONS.find((item) => item.value === code);
  return found ? found.label : code;
}

function shouldSkipKeybindingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  return target.isContentEditable;
}

function isShortcutRecording(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return document.querySelector('[data-shortcut-recording="true"]') !== null;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function isWindowsTauriRuntime(): boolean {
  if (!isTauriRuntime() || typeof navigator === 'undefined') {
    return false;
  }
  return navigator.userAgent.includes('Windows');
}

function hasActiveModifiers(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
}

type ShortcutAction =
  | 'input_translate'
  | 'selection_translate'
  | 'ocr_translate'
  | 'ocr_recognize'
  | 'hide_interface'
  | 'show_main_window'
  | 'open_settings';

export function App() {
  const [taskState, setTaskState] = useState(initialTaskState);
  const [settings, setSettings] = useState<SettingsState>(() => loadSettingsFromStorage());
  const pendingShortcutActionRef = useRef<ShortcutAction | null>(null);

  const targetLang = settings.secondaryLanguage;

  const applyTaskState = useCallback(
    (next: Awaited<ReturnType<typeof triggerSelectionTranslate>>) => {
      setTaskState(taskReducer(next.action, next.payload));
      reportTask(next);
    },
    [],
  );

  const presentOcrResultWindow = useCallback(
    async (payload: OcrResultWindowPayload, taskType: TaskType) => {
      try {
        await showOcrResultWindow(payload);
      } catch (error) {
        setTaskState(makeUiError(taskType, `打开 OCR 结果窗口失败: ${String(error)}`));
      }
    },
    [],
  );

  const translationWorkspaceLabels = useCallback(
    () => ({
      sourceLanguageCode: settings.primaryLanguage,
      sourceLanguageLabel: languageLabel(settings.primaryLanguage),
      targetLanguageCode: settings.secondaryLanguage,
      targetLanguageLabel: languageLabel(settings.secondaryLanguage),
    }),
    [settings.primaryLanguage, settings.secondaryLanguage],
  );

  const presentRecognizedTextWorkspace = useCallback(
    async (taskType: TaskType, result: TaskResult | undefined) => {
      if (!result) {
        return;
      }

      await presentOcrResultWindow(
        createOcrRecognizePayload(result, translationWorkspaceLabels()),
        taskType,
      );
    },
    [presentOcrResultWindow, translationWorkspaceLabels],
  );

  const presentTranslatedTextWorkspace = useCallback(
    async (taskType: TaskType, result: TaskResult | undefined) => {
      if (!result) {
        return;
      }

      await presentOcrResultWindow(
        createOcrTranslatePayload(result, translationWorkspaceLabels()),
        taskType,
      );
    },
    [presentOcrResultWindow, translationWorkspaceLabels],
  );

  const runSelectionTranslate = useCallback(async () => {
    const next = await triggerSelectionTranslate(taskState, targetLang);
    applyTaskState(next);
  }, [applyTaskState, targetLang, taskState]);

  const runOcrTranslate = useCallback(async () => {
    if (isWindowsTauriRuntime()) {
      await showScreenshotOverlay({
        mode: 'ocr_translate',
        sourceLanguageLabel: languageLabel(settings.primaryLanguage),
        sourceLangHint: settings.primaryLanguage,
        targetLang: targetLang,
        targetLanguageCode: settings.secondaryLanguage,
        targetLanguageLabel: languageLabel(settings.secondaryLanguage),
      });
      return;
    }
    const next = await triggerOcrTranslate(taskState, targetLang, 'auto', settings.primaryLanguage);
    applyTaskState(next);
    if (next.action === 'succeeded') {
      await presentTranslatedTextWorkspace(next.payload.taskType, next.payload.result);
    }
  }, [
    applyTaskState,
    presentTranslatedTextWorkspace,
    settings.primaryLanguage,
    settings.secondaryLanguage,
    targetLang,
    taskState,
  ]);

  const runOcrRecognize = useCallback(async () => {
    if (isWindowsTauriRuntime()) {
      await showScreenshotOverlay({
        mode: 'ocr_recognize',
        sourceLanguageLabel: languageLabel(settings.primaryLanguage),
        sourceLangHint: settings.primaryLanguage,
        targetLanguageCode: settings.secondaryLanguage,
        targetLanguageLabel: languageLabel(settings.secondaryLanguage),
      });
      return;
    }
    const next = await triggerOcrRecognize(taskState, settings.primaryLanguage);
    applyTaskState(next);
    if (next.action === 'succeeded') {
      await presentRecognizedTextWorkspace(next.payload.taskType, next.payload.result);
    }
  }, [
    applyTaskState,
    presentRecognizedTextWorkspace,
    settings.primaryLanguage,
    settings.secondaryLanguage,
    taskState,
  ]);

  const openInputTranslateWorkspace = useCallback(async () => {
    await presentOcrResultWindow(
      createInputTranslatePayload(translationWorkspaceLabels()),
      'input_translate',
    );
  }, [presentOcrResultWindow, translationWorkspaceLabels]);

  const focusSettingsWindow = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const currentWindow = getCurrentWindow();
      await currentWindow.show();
      await currentWindow.unminimize();
      await currentWindow.setFocus();
    } catch (error) {
      console.error('failed to focus settings window', error);
    }
  }, []);

  const hideCurrentWindow = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().hide();
    } catch (error) {
      console.error('failed to hide current window', error);
    }
  }, []);

  const executeShortcutAction = useCallback(
    (action: ShortcutAction) => {
      if (action === 'input_translate') {
        void openInputTranslateWorkspace();
        return;
      }
      if (action === 'selection_translate') {
        void runSelectionTranslate();
        return;
      }
      if (action === 'ocr_translate') {
        void runOcrTranslate();
        return;
      }
      if (action === 'hide_interface') {
        void hideCurrentWindow();
        return;
      }
      if (action === 'show_main_window') {
        return;
      }
      if (action === 'open_settings') {
        void focusSettingsWindow();
        return;
      }
      void runOcrRecognize();
    },
    [
      focusSettingsWindow,
      hideCurrentWindow,
      openInputTranslateWorkspace,
      runOcrRecognize,
      runOcrTranslate,
      runSelectionTranslate,
    ],
  );

  const handleTrayAction = useCallback(
    async (action: TrayAction) => {
      if (action === 'input_translate') {
        await openInputTranslateWorkspace();
        return;
      }
      if (action === 'selection_translate') {
        await runSelectionTranslate();
        return;
      }
      if (action === 'ocr_translate') {
        await runOcrTranslate();
        return;
      }
      if (action === 'ocr_recognize') {
        await runOcrRecognize();
        return;
      }
      if (action === 'show_main_window') {
        return;
      }
      if (action === 'open_settings') {
        await focusSettingsWindow();
        return;
      }
      if (action === 'check_update') {
        return;
      }
    },
    [
      focusSettingsWindow,
      openInputTranslateWorkspace,
      runOcrRecognize,
      runOcrTranslate,
      runSelectionTranslate,
    ],
  );

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let cleanup: null | (() => void) = null;
    let disposed = false;

    async function bindTrayActionListener() {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const unlisten = await listen(TRAY_ACTION_EVENT, (event) => {
          if (!isTrayActionPayload(event.payload)) {
            return;
          }
          void handleTrayAction(event.payload.action);
        });
        if (disposed) {
          unlisten();
          return;
        }
        cleanup = unlisten;
      } catch (error) {
        console.warn('tray action listener binding failed', error);
      }
    }

    void bindTrayActionListener();
    return () => {
      disposed = true;
      if (cleanup) {
        cleanup();
      }
    };
  }, [handleTrayAction]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    void syncNativeShortcuts(settings.shortcuts).catch((error) => {
      console.error('native shortcut sync failed', error);
    });
  }, [settings.shortcuts]);

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

  useEffect(() => {
    saveSettingsToStorage(settings);
  }, [settings]);

  useEffect(() => {
    if (isTauriRuntime()) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (isShortcutRecording()) {
        return;
      }
      if (shouldSkipKeybindingTarget(event.target)) {
        return;
      }

      if (matchesShortcut(event, settings.shortcuts.inputTranslate)) {
        event.preventDefault();
        pendingShortcutActionRef.current = 'input_translate';
        return;
      }
      if (matchesShortcut(event, settings.shortcuts.ocrTranslate)) {
        event.preventDefault();
        pendingShortcutActionRef.current = 'ocr_translate';
        return;
      }
      if (matchesShortcut(event, settings.shortcuts.hideInterface)) {
        event.preventDefault();
        pendingShortcutActionRef.current = 'hide_interface';
        return;
      }
      if (matchesShortcut(event, settings.shortcuts.selectionTranslate)) {
        event.preventDefault();
        pendingShortcutActionRef.current = 'selection_translate';
        return;
      }
      if (matchesShortcut(event, settings.shortcuts.ocrRecognize)) {
        event.preventDefault();
        pendingShortcutActionRef.current = 'ocr_recognize';
        return;
      }
      if (matchesShortcut(event, settings.shortcuts.openSettings)) {
        event.preventDefault();
        pendingShortcutActionRef.current = 'open_settings';
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const pendingAction = pendingShortcutActionRef.current;
      if (!pendingAction) {
        return;
      }
      if (hasActiveModifiers(event)) {
        return;
      }
      pendingShortcutActionRef.current = null;
      executeShortcutAction(pendingAction);
    };

    const onWindowBlur = () => {
      pendingShortcutActionRef.current = null;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [executeShortcutAction, settings.shortcuts]);

  return (
    <MainLayout>
      <section className="workspace">
        <section className="settingsHome">
          <SettingsPanel value={settings} onChange={setSettings} />
        </section>
      </section>
    </MainLayout>
  );
}
