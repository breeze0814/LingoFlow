import { initialTaskState } from '../task/taskReducer';
import { triggerInputTranslate } from '../task/taskService';
import { TaskResult } from '../task/taskTypes';
import { OcrResultWindowPayload } from './ocrResultWindowBridge';

export type TranslationWorkspaceStatus = 'idle' | 'pending' | 'success' | 'failure';

export type TranslationWorkspaceState = {
  errorMessage: string;
  result: TaskResult | null;
  status: TranslationWorkspaceStatus;
  text: string;
};

type SubmitResult = {
  errorMessage: string;
  result: TaskResult | null;
  status: TranslationWorkspaceStatus;
};

type WorkspaceDirection = {
  sourceLanguageCode: string;
  targetLanguageCode: string;
};

export function createTranslationWorkspaceState(
  payload: OcrResultWindowPayload | null,
): TranslationWorkspaceState {
  if (!payload) {
    return {
      errorMessage: '',
      result: null,
      status: 'idle',
      text: '',
    };
  }

  return {
    errorMessage: payload.initialErrorMessage ?? '',
    result: payload.result ?? null,
    status: payload.result ? 'success' : payload.initialErrorMessage ? 'failure' : 'idle',
    text: payload.initialText,
  };
}

export async function submitTranslationWorkspaceText(
  payload: OcrResultWindowPayload,
  text: string,
  direction?: WorkspaceDirection,
): Promise<SubmitResult> {
  if (!text.trim()) {
    return {
      errorMessage: '输入内容为空，无法翻译。',
      result: null,
      status: 'failure',
    };
  }

  const response = await triggerInputTranslate(initialTaskState, {
    sourceLang: direction?.sourceLanguageCode ?? payload.sourceLanguageCode,
    text,
    targetLang: direction?.targetLanguageCode ?? payload.targetLanguageCode,
  });

  if (response.action === 'succeeded' && response.payload.result) {
    return {
      errorMessage: '',
      result: response.payload.result,
      status: 'success',
    };
  }

  if (response.action === 'failed') {
    return {
      errorMessage: response.payload.error?.message ?? '翻译失败',
      result: null,
      status: 'failure',
    };
  }

  return {
    errorMessage: response.action === 'cancelled' ? '翻译已取消' : '翻译失败',
    result: null,
    status: 'failure',
  };
}
