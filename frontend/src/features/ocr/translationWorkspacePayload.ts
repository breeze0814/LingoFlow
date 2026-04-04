import { TaskResult } from '../task/taskTypes';
import { OcrResultWindowPayload } from './ocrResultWindowBridge';

type WorkspaceLabels = {
  sourceLanguageLabel: string;
  targetLanguageLabel: string;
  targetLanguageCode: string;
};

function createPayload(
  mode: OcrResultWindowPayload['mode'],
  initialText: string,
  labels: WorkspaceLabels,
  autoTranslate: boolean,
  result?: TaskResult,
): OcrResultWindowPayload {
  return {
    mode,
    initialText,
    sourceLanguageLabel: labels.sourceLanguageLabel,
    targetLanguageLabel: labels.targetLanguageLabel,
    targetLanguageCode: labels.targetLanguageCode,
    autoTranslate,
    result,
  };
}

export function createInputTranslatePayload(labels: WorkspaceLabels): OcrResultWindowPayload {
  return createPayload('input_translate', '', labels, false);
}

export function createOcrRecognizePayload(
  result: TaskResult,
  labels: WorkspaceLabels,
): OcrResultWindowPayload {
  return createPayload('ocr_recognize', result.sourceText, labels, false, result);
}

export function createOcrTranslatePayload(
  result: TaskResult,
  labels: WorkspaceLabels,
): OcrResultWindowPayload {
  return createPayload('ocr_translate', result.sourceText, labels, false, result);
}
