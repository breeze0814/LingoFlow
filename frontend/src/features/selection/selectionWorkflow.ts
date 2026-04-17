import { commandsClient } from '../../infra/tauri/commands';
import { AppError } from '../task/taskTypes';
import { OcrResultWindowPayload, readCachedOcrResultPayload } from '../ocr/ocrResultWindowBridge';
import {
  createErrorPayload,
  createInputTranslatePayload,
} from '../ocr/translationWorkspacePayload';

type SelectionSettings = {
  autoQueryOnSelection: boolean;
  defaultTranslateProvider: string;
  keepResultForSelection: boolean;
};

type WorkspaceLabels = {
  sourceLanguageCode: string;
  sourceLanguageLabel: string;
  targetLanguageCode: string;
  targetLanguageLabel: string;
};

export type SelectionWorkflowOutcome =
  | {
      kind: 'show_cached';
    }
  | {
      kind: 'show_payload';
      payload: OcrResultWindowPayload;
    };

function mapSelectionError(error: unknown): AppError {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'retryable' in error
  ) {
    return error as AppError;
  }
  if (error instanceof Error) {
    return {
      code: 'internal_error',
      message: error.message,
      retryable: true,
    };
  }
  return {
    code: 'internal_error',
    message: '读取选中文本失败',
    retryable: true,
  };
}

function missingSelectionOutcome(labels: WorkspaceLabels): SelectionWorkflowOutcome {
  return {
    kind: 'show_payload',
    payload: createErrorPayload('input_translate', '未检测到选中文本', labels),
  };
}

function noSelectionOutcome(
  settings: SelectionSettings,
  labels: WorkspaceLabels,
): SelectionWorkflowOutcome {
  if (settings.keepResultForSelection && readCachedOcrResultPayload()) {
    return { kind: 'show_cached' };
  }
  return missingSelectionOutcome(labels);
}

export async function resolveSelectionWorkflowOutcome(
  settings: SelectionSettings,
  labels: WorkspaceLabels,
): Promise<SelectionWorkflowOutcome> {
  try {
    const response = await commandsClient.readSelectionText();
    const selectedText = response.selectedText.trim();
    if (!selectedText) {
      return noSelectionOutcome(settings, labels);
    }

    return {
      kind: 'show_payload',
      payload: {
        ...createInputTranslatePayload(labels, selectedText, settings.defaultTranslateProvider),
        autoTranslate: settings.autoQueryOnSelection,
      },
    };
  } catch (error) {
    const appError = mapSelectionError(error);
    if (appError.code === 'no_selection') {
      return noSelectionOutcome(settings, labels);
    }

    return {
      kind: 'show_payload',
      payload: createErrorPayload('input_translate', appError.message, labels),
    };
  }
}
