import { TaskResult } from '../task/taskTypes';

export const OCR_RESULT_WINDOW_LABEL = 'ocr_result';
export const OCR_RESULT_WINDOW_QUERY = '/?window=ocr_result';
export const OCR_RESULT_UPDATE_EVENT = 'ocr://result/update';

const OCR_RESULT_CACHE_KEY = 'lingoflow.ocr_result.latest';

type RecordObject = Record<string, unknown>;

export type OcrResultWindowPayload = {
  result: TaskResult;
  sourceLanguageLabel: string;
  targetLanguageLabel: string;
};

function isRecordObject(value: unknown): value is RecordObject {
  return typeof value === 'object' && value !== null;
}

function isTaskResult(value: unknown): value is TaskResult {
  if (!isRecordObject(value)) {
    return false;
  }
  return (
    typeof value.taskId === 'string' &&
    typeof value.providerId === 'string' &&
    typeof value.sourceText === 'string'
  );
}

export function isOcrResultWindowPayload(value: unknown): value is OcrResultWindowPayload {
  if (!isRecordObject(value)) {
    return false;
  }
  return (
    isTaskResult(value.result) &&
    typeof value.sourceLanguageLabel === 'string' &&
    typeof value.targetLanguageLabel === 'string'
  );
}

export function cacheOcrResultPayload(payload: OcrResultWindowPayload) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(OCR_RESULT_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('failed to cache OCR result payload', error);
  }
}

export function clearCachedOcrResultPayload() {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(OCR_RESULT_CACHE_KEY);
  } catch (error) {
    console.error('failed to clear cached OCR result payload', error);
  }
}

export function readCachedOcrResultPayload(): OcrResultWindowPayload | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(OCR_RESULT_CACHE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!isOcrResultWindowPayload(parsed)) {
      throw new Error('invalid OCR result payload');
    }
    return parsed;
  } catch (error) {
    console.error('failed to read cached OCR result payload', error);
    return null;
  }
}
