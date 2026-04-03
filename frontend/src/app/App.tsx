import { useCallback, useEffect, useRef, useState } from 'react';
import { MainLayout } from './layout/MainLayout';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import { InputDialog } from '../features/input/InputDialog';
import { initialTaskState, taskReducer } from '../features/task/taskReducer';
import {
  triggerInputTranslate,
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
import { showOcrResultWindow } from '../features/ocr/ocrResultWindowService';
import { OcrResultWindowPayload } from '../features/ocr/ocrResultWindowBridge';

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

function buildOcrWindowPayload(
  result: TaskResult,
  sourceLanguageLabel: string,
  targetLanguageLabel: string,
): OcrResultWindowPayload {
  return {
    result,
    sourceLanguageLabel,
    targetLanguageLabel,
  };
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

function hasActiveModifiers(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
}

type ShortcutAction = 'input_translate' | 'selection_translate' | 'ocr_translate' | 'ocr_recognize';

export function App() {
  const [taskState, setTaskState] = useState(initialTaskState);
  const [settings, setSettings] = useState<SettingsState>(() => loadSettingsFromStorage());
  const [showInput, setShowInput] = useState(false);
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
    async (taskType: TaskType, result: TaskResult | undefined) => {
      if (!result) {
        console.log('[presentOcrResultWindow] result is undefined');
        return;
      }
      try {
        console.log('[presentOcrResultWindow] result:', result);
        console.log('[presentOcrResultWindow] captureRect:', result.captureRect);
        const payload = buildOcrWindowPayload(
          result,
          languageLabel(settings.primaryLanguage),
          languageLabel(settings.secondaryLanguage),
        );
        console.log('[presentOcrResultWindow] payload:', payload);
        await showOcrResultWindow(payload);
        console.log('[presentOcrResultWindow] window shown successfully');
      } catch (error) {
        console.error('[presentOcrResultWindow] error:', error);
        setTaskState(makeUiError(taskType, `打开 OCR 结果窗口失败: ${String(error)}`));
      }
    },
    [settings.primaryLanguage, settings.secondaryLanguage],
  );

  const runSelectionTranslate = useCallback(async () => {
    const next = await triggerSelectionTranslate(taskState, targetLang);
    applyTaskState(next);
  }, [applyTaskState, targetLang, taskState]);

  const runOcrTranslate = useCallback(async () => {
    const next = await triggerOcrTranslate(taskState, targetLang, 'auto', settings.primaryLanguage);
    applyTaskState(next);
    if (next.action === 'succeeded') {
      await presentOcrResultWindow(next.payload.taskType, next.payload.result);
    }
  }, [applyTaskState, presentOcrResultWindow, settings.primaryLanguage, targetLang, taskState]);

  const runOcrRecognize = useCallback(async () => {
    const next = await triggerOcrRecognize(taskState, settings.primaryLanguage);
    applyTaskState(next);
    if (next.action === 'succeeded') {
      await presentOcrResultWindow(next.payload.taskType, next.payload.result);
    }
  }, [applyTaskState, presentOcrResultWindow, settings.primaryLanguage, taskState]);

  const runInputTranslate = useCallback(
    async (text: string) => {
      const next = await triggerInputTranslate(taskState, { text, targetLang });
      applyTaskState(next);
      setShowInput(false);
    },
    [applyTaskState, targetLang, taskState],
  );

  const runClipboardTranslate = useCallback(async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        setTaskState(makeUiError('input_translate', '剪贴板内容为空，无法翻译。'));
        return;
      }
      await runInputTranslate(text);
    } catch (error) {
      setTaskState(makeUiError('input_translate', `读取剪贴板失败: ${String(error)}`));
    }
  }, [runInputTranslate]);

  const executeShortcutAction = useCallback(
    (action: ShortcutAction) => {
      if (action === 'input_translate') {
        setShowInput(true);
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
      void runOcrRecognize();
    },
    [runOcrRecognize, runOcrTranslate, runSelectionTranslate],
  );

  const handleTrayAction = useCallback(
    async (action: TrayAction) => {
      if (action === 'input_translate') {
        setShowInput(true);
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
      if (action === 'clipboard_translate') {
        await runClipboardTranslate();
        return;
      }
      if (
        action === 'open_settings' ||
        action === 'show_main_window' ||
        action === 'check_update'
      ) {
        return;
      }
    },
    [runClipboardTranslate, runOcrRecognize, runOcrTranslate, runSelectionTranslate],
  );

  useEffect(() => {
    const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    if (!isTauriRuntime) {
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
    saveSettingsToStorage(settings);
  }, [settings]);

  useEffect(() => {
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
      if (matchesShortcut(event, settings.shortcuts.selectionTranslate)) {
        event.preventDefault();
        pendingShortcutActionRef.current = 'selection_translate';
        return;
      }
      if (matchesShortcut(event, settings.shortcuts.ocrRecognize)) {
        event.preventDefault();
        pendingShortcutActionRef.current = 'ocr_recognize';
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
      <InputDialog
        open={showInput}
        clearAfterSubmit={settings.clearInputOnTranslate}
        onCancel={() => setShowInput(false)}
        onSubmit={runInputTranslate}
      />
    </MainLayout>
  );
}
