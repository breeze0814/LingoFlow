import { commandsClient } from '../../infra/tauri/commands';
import { AppError, TaskState, TaskType } from './taskTypes';

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
    };
    error?: AppError;
  };
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
  } | null;
  error?: AppError | null;
};

type RunnerInput = {
  state: TaskState;
  taskType: TaskType;
  request: () => Promise<CommandTaskResponse>;
};

function makeTaskId(state: TaskState) {
  if (state.taskId) return state.taskId;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `task_${Date.now()}`;
}

function mapResult(data: {
  provider_id: string;
  source_text: string;
  translated_text?: string;
  recognized_text?: string;
}) {
  return {
    taskId: '',
    providerId: data.provider_id,
    sourceText: data.source_text,
    translatedText: data.translated_text,
    recognizedText: data.recognized_text,
  };
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
    if (response.ok && response.data) {
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

export function triggerSelectionTranslate(state: TaskState, targetLang: string) {
  return runTask({
    state,
    taskType: 'selection_translate',
    request: () => commandsClient.selectionTranslate({ targetLang }),
  });
}

export function triggerInputTranslate(
  state: TaskState,
  input: { text: string; targetLang: string },
) {
  return runTask({
    state,
    taskType: 'input_translate',
    request: () => commandsClient.inputTranslate(input),
  });
}

export function triggerOcrRecognize(state: TaskState, sourceLangHint?: string) {
  return runTask({
    state,
    taskType: 'ocr_recognize',
    request: () => commandsClient.ocrRecognize({ sourceLangHint }),
  });
}

export function triggerOcrTranslate(state: TaskState, targetLang: string, sourceLangHint?: string) {
  return runTask({
    state,
    taskType: 'ocr_translate',
    request: () => commandsClient.ocrTranslate({ targetLang, sourceLangHint }),
  });
}
