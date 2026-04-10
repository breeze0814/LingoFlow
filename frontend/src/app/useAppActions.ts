import { useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { taskReducer } from '../features/task/taskReducer';
import { triggerOcrRecognize, triggerOcrTranslate } from '../features/task/taskService';
import { SettingsState } from '../features/settings/settingsTypes';
import { reportTask } from '../features/task/taskReporter';
import {
  showCachedOcrResultWindow,
  showOcrResultWindow,
} from '../features/ocr/ocrResultWindowService';
import { OcrResultWindowPayload } from '../features/ocr/ocrResultWindowBridge';
import { resolveSelectionWorkflowOutcome } from '../features/selection/selectionWorkflow';
import {
  createInputTranslatePayload,
  createOcrRecognizePayload,
  createOcrTranslatePayload,
} from '../features/ocr/translationWorkspacePayload';
import { showScreenshotOverlay } from '../features/screenshot/screenshotOverlayService';
import {
  buildEnabledOcrProviderConfigs,
  resolveOcrProviderRequestId,
} from '../features/settings/ocrProviderRequest';
import { TrayAction } from '../features/tray/trayEvents';
import { TaskResult, TaskState, TaskType } from '../features/task/taskTypes';
import { OpenInputTranslatePayload } from '../features/translator/inputTranslateEvents';
import { ShortcutAction, isWindowsTauriRuntime, languageLabel } from './appRuntime';

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

type TranslationWorkspaceLabels = {
  sourceLanguageCode: string;
  sourceLanguageLabel: string;
  targetLanguageCode: string;
  targetLanguageLabel: string;
};

type UseAppActionsOptions = {
  settings: SettingsState;
  taskState: TaskState;
  setTaskState: (next: TaskState) => void;
};

function assertNeverAction(action: never): never {
  throw new Error(`unsupported action: ${action}`);
}

export function useAppActions({ settings, taskState, setTaskState }: UseAppActionsOptions) {
  const applyTaskState = useCallback(
    (next: Awaited<ReturnType<typeof triggerOcrTranslate>>) => {
      setTaskState(taskReducer(next.action, next.payload));
      reportTask(next);
    },
    [setTaskState],
  );

  const presentOcrResultWindow = useCallback(
    async (payload: OcrResultWindowPayload, taskType: TaskType) => {
      try {
        await showOcrResultWindow(payload);
      } catch (error) {
        setTaskState(makeUiError(taskType, `打开 OCR 结果窗口失败: ${String(error)}`));
      }
    },
    [setTaskState],
  );

  const translationWorkspaceLabels = useCallback<() => TranslationWorkspaceLabels>(
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
        createOcrRecognizePayload(
          result,
          translationWorkspaceLabels(),
          settings.autoQueryOnOcr,
          settings.defaultTranslateProvider,
        ),
        taskType,
      );
    },
    [
      presentOcrResultWindow,
      settings.autoQueryOnOcr,
      settings.defaultTranslateProvider,
      translationWorkspaceLabels,
    ],
  );

  const presentPendingTranslatedTextWorkspace = useCallback(
    async (taskType: TaskType, result: TaskResult | undefined) => {
      if (!result) {
        return;
      }

      await presentOcrResultWindow(
        createOcrTranslatePayload(
          result,
          translationWorkspaceLabels(),
          true,
          settings.defaultTranslateProvider,
        ),
        taskType,
      );
    },
    [presentOcrResultWindow, settings.defaultTranslateProvider, translationWorkspaceLabels],
  );

  const runSelectionTranslate = useCallback(async () => {
    const outcome = await resolveSelectionWorkflowOutcome(
      {
        autoQueryOnSelection: settings.autoQueryOnSelection,
        defaultTranslateProvider: settings.defaultTranslateProvider,
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
    settings.defaultTranslateProvider,
    settings.keepResultForSelection,
    translationWorkspaceLabels,
  ]);

  const runOcrTranslate = useCallback(async () => {
    if (isWindowsTauriRuntime()) {
      await showScreenshotOverlay({
        mode: 'ocr_translate',
        sourceLanguageLabel: languageLabel(settings.primaryLanguage),
        sourceLangHint: settings.primaryLanguage,
        targetLang: settings.secondaryLanguage,
        targetLanguageCode: settings.secondaryLanguage,
        targetLanguageLabel: languageLabel(settings.secondaryLanguage),
      });
      return;
    }
    const next = await triggerOcrRecognize(
      taskState,
      settings.primaryLanguage,
      resolveOcrProviderRequestId(settings.defaultOcrProvider),
      buildEnabledOcrProviderConfigs(settings.providers),
    );
    applyTaskState(next);
    if (next.action === 'succeeded') {
      await presentPendingTranslatedTextWorkspace('ocr_translate', next.payload.result);
    }
  }, [
    applyTaskState,
    presentPendingTranslatedTextWorkspace,
    settings.defaultOcrProvider,
    settings.primaryLanguage,
    settings.secondaryLanguage,
    settings.providers,
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
    const next = await triggerOcrRecognize(
      taskState,
      settings.primaryLanguage,
      resolveOcrProviderRequestId(settings.defaultOcrProvider),
      buildEnabledOcrProviderConfigs(settings.providers),
    );
    applyTaskState(next);
    if (next.action === 'succeeded') {
      await presentRecognizedTextWorkspace(next.payload.taskType, next.payload.result);
    }
  }, [
    applyTaskState,
    presentRecognizedTextWorkspace,
    settings.defaultOcrProvider,
    settings.primaryLanguage,
    settings.secondaryLanguage,
    settings.providers,
    taskState,
  ]);

  const openInputTranslateWorkspace = useCallback(
    async (request?: OpenInputTranslatePayload) => {
      const sourceLanguageCode = request?.sourceLang ?? settings.primaryLanguage;
      const targetLanguageCode = request?.targetLang ?? settings.secondaryLanguage;
      await presentOcrResultWindow(
        createInputTranslatePayload(
          {
            sourceLanguageCode,
            sourceLanguageLabel: languageLabel(sourceLanguageCode),
            targetLanguageCode,
            targetLanguageLabel: languageLabel(targetLanguageCode),
          },
          request?.text ?? '',
          settings.defaultTranslateProvider,
        ),
        'input_translate',
      );
    },
    [
      presentOcrResultWindow,
      settings.defaultTranslateProvider,
      settings.primaryLanguage,
      settings.secondaryLanguage,
    ],
  );

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
      switch (action) {
        case 'input_translate':
          void openInputTranslateWorkspace();
          return;
        case 'selection_translate':
          void runSelectionTranslate();
          return;
        case 'ocr_translate':
          void runOcrTranslate();
          return;
        case 'hide_interface':
          void hideCurrentWindow();
          return;
        case 'show_main_window':
          return;
        case 'open_settings':
          void focusSettingsWindow();
          return;
        case 'ocr_recognize':
          void runOcrRecognize();
          return;
      }
      assertNeverAction(action);
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
      switch (action) {
        case 'input_translate':
          await openInputTranslateWorkspace();
          return;
        case 'selection_translate':
          await runSelectionTranslate();
          return;
        case 'ocr_translate':
          await runOcrTranslate();
          return;
        case 'ocr_recognize':
          await runOcrRecognize();
          return;
        case 'show_main_window':
          return;
        case 'open_settings':
          await focusSettingsWindow();
          return;
      }
      assertNeverAction(action);
    },
    [
      focusSettingsWindow,
      openInputTranslateWorkspace,
      runOcrRecognize,
      runOcrTranslate,
      runSelectionTranslate,
    ],
  );

  return {
    executeShortcutAction,
    handleTrayAction,
    openInputTranslateWorkspace,
  };
}
