import { commandsClient } from '../../infra/tauri/commands';
import { AppError, ProviderTranslationResult, TaskState, TaskType } from './taskTypes';
import { OcrProviderRequestConfig } from '../settings/ocrProviderRequest';
import { TranslateProviderRequestConfig } from '../settings/translateProviderRequest';

type TriggerResponse = {
  action: 'triggered' | 'succeeded' | 'failed' | 'cancelled';
  payload: {
    taskType: TaskType;
    taskId: string;
    result?: {
      taskId: string;
      providerId: string;
      sourceText: string;
      translatedText?: string;
      recognizedText?: string;
      translationResults?: ProviderTranslationResult[];
    };
    error?: AppError;
  };
};

type CommandProviderTranslation = {
  provider_id: string;
  translated_text?: string;
  error?: AppError | null;
};

type CommandTaskResponse = {
  ok: boolean;
  task_id: string;
  status: 'success' | 'failure' | 'cancelled' | 'accepted';
  data?: {
    provider_id: string;
    source_text: string;
    translated_text?: string;
    recognized_text?: string;
    translation_results?: CommandProviderTranslation[];
  } | null;
  error?: AppError | null;
};

type RunnerInput = {
  state: TaskState;
  taskType: TaskType;
  request: () => Promise<CommandTaskResponse>;
};

const FALLBACK_TASK_RANDOM_RANGE = 1_000_000;

function makeTaskId(state: TaskState) {
  const previousTaskIdSeed = state.taskId ? `${state.taskId}_` : '';
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${previousTaskIdSeed}${crypto.randomUUID()}`;
  }
  return `${previousTaskIdSeed}task_${Date.now()}_${Math.floor(Math.random() * FALLBACK_TASK_RANDOM_RANGE)}`;
}

function mapResult(data: {
  provider_id: string;
  source_text: string;
  translated_text?: string;
  recognized_text?: string;
  translation_results?: CommandProviderTranslation[];
}) {
  return {
    taskId: '',
    providerId: data.provider_id,
    sourceText: data.source_text,
    translatedText: data.translated_text,
    recognizedText: data.recognized_text,
    translationResults: mapTranslationResults(data),
  };
}

function mapTranslationResults(data: {
  provider_id: string;
  translated_text?: string;
  translation_results?: CommandProviderTranslation[];
}): ProviderTranslationResult[] {
  if (data.translation_results && data.translation_results.length > 0) {
    return data.translation_results.map((item) => ({
      providerId: item.provider_id,
      translatedText: item.translated_text,
      error: item.error ?? undefined,
    }));
  }
  if (!data.translated_text) {
    return [];
  }
  return [
    {
      providerId: data.provider_id,
      translatedText: data.translated_text,
    },
  ];
}

function mapRemoteError(error?: AppError | null): AppError {
  if (!error) {
    return { code: 'internal_error', message: 'Unknown error', retryable: true };
  }
  return error;
}

function mapUnknownError(error: unknown): AppError {
  if (error instanceof Error) {
    return { code: 'internal_error', message: error.message, retryable: true };
  }
  return { code: 'internal_error', message: 'Unknown error', retryable: true };
}

function success(
  taskType: TaskType,
  taskId: string,
  response: CommandTaskResponse,
): TriggerResponse {
  return {
    action: 'succeeded',
    payload: {
      taskType,
      taskId,
      result: response.data ? { ...mapResult(response.data), taskId } : undefined,
    },
  };
}

function failed(taskType: TaskType, taskId: string, error?: AppError | null): TriggerResponse {
  return {
    action: 'failed',
    payload: {
      taskType,
      taskId,
      error: mapRemoteError(error),
    },
  };
}

function cancelled(taskType: TaskType, taskId: string): TriggerResponse {
  return {
    action: 'cancelled',
    payload: {
      taskType,
      taskId,
    },
  };
}

async function runTask(input: RunnerInput): Promise<TriggerResponse> {
  const fallbackTaskId = makeTaskId(input.state);
  try {
    const response = await input.request();
    const taskId = response.task_id || fallbackTaskId;
    if (response.status === 'accepted') {
      return {
        action: 'triggered',
        payload: {
          taskType: input.taskType,
          taskId,
        },
      };
    }
    if (response.ok && response.status === 'success') {
      return success(input.taskType, taskId, response);
    }
    if (response.status === 'cancelled') {
      return cancelled(input.taskType, taskId);
    }
    return failed(input.taskType, taskId, response.error);
  } catch (error) {
    return {
      action: 'failed',
      payload: {
        taskType: input.taskType,
        taskId: fallbackTaskId,
        error: mapUnknownError(error),
      },
    };
  }
}

export function triggerSelectionTranslate(
  state: TaskState,
  targetLang: string,
  translateProviderConfigs?: TranslateProviderRequestConfig[],
) {
  return runTask({
    state,
    taskType: 'selection_translate',
    request: () => commandsClient.selectionTranslate({ targetLang, translateProviderConfigs }),
  });
}

export function triggerInputTranslate(
  state: TaskState,
  input: {
    sourceLang?: string;
    text: string;
    targetLang: string;
    translateProviderConfigs?: TranslateProviderRequestConfig[];
  },
) {
  return runTask({
    state,
    taskType: 'input_translate',
    request: () => commandsClient.inputTranslate(input),
  });
}

export function triggerOcrRecognize(
  state: TaskState,
  sourceLangHint?: string,
  ocrProviderId?: string,
  ocrProviderConfigs?: OcrProviderRequestConfig[],
) {
  return runTask({
    state,
    taskType: 'ocr_recognize',
    request: () =>
      commandsClient.ocrRecognize({ sourceLangHint, ocrProviderId, ocrProviderConfigs }),
  });
}

export function triggerOcrRecognizeRegion(
  state: TaskState,
  captureRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
  sourceLangHint?: string,
  ocrProviderId?: string,
  ocrProviderConfigs?: OcrProviderRequestConfig[],
) {
  return runTask({
    state,
    taskType: 'ocr_recognize',
    request: () =>
      commandsClient.ocrRecognizeRegion({
        captureRect,
        sourceLangHint,
        ocrProviderId,
        ocrProviderConfigs,
      }),
  });
}

export function triggerOcrTranslate(
  state: TaskState,
  targetLang: string,
  sourceLang?: string,
  sourceLangHint?: string,
  translateProviderConfigs?: TranslateProviderRequestConfig[],
  ocrProviderId?: string,
  ocrProviderConfigs?: OcrProviderRequestConfig[],
) {
  return runTask({
    state,
    taskType: 'ocr_translate',
    request: () =>
      commandsClient.ocrTranslate({
        ocrProviderId,
        ocrProviderConfigs,
        sourceLang,
        targetLang,
        sourceLangHint,
        translateProviderConfigs,
      }),
  });
}

export function triggerOcrTranslateRegion(
  state: TaskState,
  captureRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
  targetLang: string,
  sourceLang?: string,
  sourceLangHint?: string,
  translateProviderConfigs?: TranslateProviderRequestConfig[],
  ocrProviderId?: string,
  ocrProviderConfigs?: OcrProviderRequestConfig[],
) {
  return runTask({
    state,
    taskType: 'ocr_translate',
    request: () =>
      commandsClient.ocrTranslateRegion({
        captureRect,
        ocrProviderId,
        ocrProviderConfigs,
        sourceLang,
        targetLang,
        sourceLangHint,
        translateProviderConfigs,
      }),
  });
}
