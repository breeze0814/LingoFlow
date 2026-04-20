import { TaskResult } from '../task/taskTypes';
import { OcrResultWindowPayload } from './ocrResultWindowBridge';

type WorkspaceLabels = {
  sourceLanguageCode: string;
  sourceLanguageLabel: string;
  targetLanguageLabel: string;
  targetLanguageCode: string;
};

function createPayload(
  mode: OcrResultWindowPayload['mode'],
  initialText: string,
  labels: WorkspaceLabels,
  autoTranslate: boolean,
  preferredProviderId?: string,
  result?: TaskResult,
): OcrResultWindowPayload {
  return {
    mode,
    initialText,
    sourceLanguageCode: labels.sourceLanguageCode,
    sourceLanguageLabel: labels.sourceLanguageLabel,
    targetLanguageLabel: labels.targetLanguageLabel,
    targetLanguageCode: labels.targetLanguageCode,
    autoTranslate,
    preferredProviderId,
    result,
  };
}

export function createInputTranslatePayload(
  labels: WorkspaceLabels,
  initialText = '',
  preferredProviderId?: string,
): OcrResultWindowPayload {
  return createPayload('input_translate', initialText, labels, false, preferredProviderId);
}

export function createOcrRecognizePayload(
  result: TaskResult,
  labels: WorkspaceLabels,
  autoTranslate = false,
  preferredProviderId?: string,
): OcrResultWindowPayload {
  return createPayload(
    'ocr_recognize',
    result.sourceText,
    labels,
    autoTranslate,
    preferredProviderId,
    result,
  );
}

export function createOcrTranslatePayload(
  result: TaskResult,
  labels: WorkspaceLabels,
  autoTranslate = false,
  preferredProviderId?: string,
): OcrResultWindowPayload {
  return createPayload(
    'ocr_translate',
    result.sourceText,
    labels,
    autoTranslate,
    preferredProviderId,
    result,
  );
}

export function createErrorPayload(
  mode: OcrResultWindowPayload['mode'],
  errorMessage: string,
  labels: WorkspaceLabels,
  preferredProviderId?: string,
): OcrResultWindowPayload {
  return {
    ...createPayload(mode, '', labels, false, preferredProviderId),
    initialErrorMessage: errorMessage,
  };
}

export function createPendingPayload(
  mode: OcrResultWindowPayload['mode'],
  labels: WorkspaceLabels,
  pendingMessage: string,
  preferredProviderId?: string,
): OcrResultWindowPayload {
  return {
    ...createPayload(mode, '', labels, false, preferredProviderId),
    initialStatus: 'pending',
    pendingMessage,
  };
}
