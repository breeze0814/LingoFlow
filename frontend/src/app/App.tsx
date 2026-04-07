import { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { MainLayout } from './layout/MainLayout';
import {
  isWindowsTauriRuntime,
  languageLabel,
  makeUiError,
  resolveSourceLanguageHint,
  type ShortcutAction,
} from './appRuntime';
import { useBrowserShortcuts } from './useBrowserShortcuts';
import { useTauriBindings } from './useTauriBindings';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import { initialTaskState, taskReducer } from '../features/task/taskReducer';
import { triggerOcrRecognize, triggerOcrTranslate } from '../features/task/taskService';
import { SettingsState } from '../features/settings/settingsTypes';
import {
  loadSettingsFromStorage,
  saveSettingsToStorage,
} from '../features/settings/settingsStorage';
import { TrayAction } from '../features/tray/trayEvents';
import { TaskResult, TaskType } from '../features/task/taskTypes';
import { reportTask } from '../features/task/taskReporter';
import {
  showOcrResultWindow,
  showCachedOcrResultWindow,
} from '../features/ocr/ocrResultWindowService';
import { OcrResultWindowPayload } from '../features/ocr/ocrResultWindowBridge';
import { resolveSelectionWorkflowOutcome } from '../features/selection/selectionWorkflow';
import {
  createInputTranslatePayload,
  createOcrRecognizePayload,
  createOcrTranslatePayload,
} from '../features/ocr/translationWorkspacePayload';
import { showScreenshotOverlay } from '../features/screenshot/screenshotOverlayService';

export function App() {
  const [taskState, setTaskState] = useState(initialTaskState);
  const [settings, setSettings] = useState<SettingsState>(() => loadSettingsFromStorage());
  const pendingShortcutActionRef = useRef<ShortcutAction | null>(null);
  const sourceLanguageHint = resolveSourceLanguageHint(settings);

  const applyTaskState = useCallback((next: Awaited<ReturnType<typeof triggerOcrTranslate>>) => {
    setTaskState(taskReducer(next.action, next.payload));
    reportTask(next);
  }, []);

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
        createOcrRecognizePayload(result, translationWorkspaceLabels(), settings.autoQueryOnOcr),
        taskType,
      );
    },
    [presentOcrResultWindow, settings.autoQueryOnOcr, translationWorkspaceLabels],
  );

  const presentPendingTranslatedTextWorkspace = useCallback(
    async (taskType: TaskType, result: TaskResult | undefined) => {
      if (!result) {
        return;
      }

      await presentOcrResultWindow(
        createOcrTranslatePayload(result, translationWorkspaceLabels(), true),
        taskType,
      );
    },
    [presentOcrResultWindow, translationWorkspaceLabels],
  );

  const runSelectionTranslate = useCallback(async () => {
    const outcome = await resolveSelectionWorkflowOutcome(
      {
        autoQueryOnSelection: settings.autoQueryOnSelection,
        keepResultForSelection: settings.keepResultForSelection,
      },
      translationWorkspaceLabels(),
    );
    if (outcome.kind === 'show_cached') {
      await showCachedOcrResultWindow();
      return;
    }
    await presentOcrResultWindow(outcome.payload, 'selection_translate');
  }, [
    presentOcrResultWindow,
    settings.autoQueryOnSelection,
    settings.keepResultForSelection,
    translationWorkspaceLabels,
  ]);

  const runOcrTranslate = useCallback(async () => {
    if (isWindowsTauriRuntime()) {
      await showScreenshotOverlay({
        mode: 'ocr_translate',
        sourceLanguageLabel: languageLabel(settings.primaryLanguage),
        sourceLangHint: sourceLanguageHint,
        targetLang: settings.secondaryLanguage,
        targetLanguageCode: settings.secondaryLanguage,
        targetLanguageLabel: languageLabel(settings.secondaryLanguage),
      });
      return;
    }
    const next = await triggerOcrRecognize(taskState, sourceLanguageHint);
    applyTaskState(next);
    if (next.action === 'succeeded') {
      await presentPendingTranslatedTextWorkspace('ocr_translate', next.payload.result);
    }
  }, [
    applyTaskState,
    presentPendingTranslatedTextWorkspace,
    settings.primaryLanguage,
    settings.secondaryLanguage,
    sourceLanguageHint,
    taskState,
  ]);

  const runOcrRecognize = useCallback(async () => {
    if (isWindowsTauriRuntime()) {
      await showScreenshotOverlay({
        mode: 'ocr_recognize',
        sourceLanguageLabel: languageLabel(settings.primaryLanguage),
        sourceLangHint: sourceLanguageHint,
        targetLanguageCode: settings.secondaryLanguage,
        targetLanguageLabel: languageLabel(settings.secondaryLanguage),
      });
      return;
    }
    const next = await triggerOcrRecognize(taskState, sourceLanguageHint);
    applyTaskState(next);
    if (next.action === 'succeeded') {
      await presentRecognizedTextWorkspace(next.payload.taskType, next.payload.result);
    }
  }, [
    applyTaskState,
    presentRecognizedTextWorkspace,
    settings.primaryLanguage,
    settings.secondaryLanguage,
    sourceLanguageHint,
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
    saveSettingsToStorage(settings);
  }, [settings]);

  useTauriBindings({
    handleTrayAction,
    httpApiEnabled: settings.httpApiEnabled,
    shortcuts: settings.shortcuts,
  });
  useBrowserShortcuts({
    executeShortcutAction,
    pendingShortcutActionRef,
    shortcuts: settings.shortcuts,
  });

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
