export const OCR_RUNTIME_WINDOW_LABEL = 'ocr_runtime';
export const OCR_RUNTIME_WINDOW_QUERY = '/?window=ocr_runtime';
export const OCR_RUNTIME_REQUEST_EVENT = 'ocr://runtime/request';

export type OcrRuntimeErrorCode =
  | 'internal_error'
  | 'ocr_empty_result'
  | 'provider_invalid_response'
  | 'provider_timeout';

export type OcrRuntimeRequestPayload = {
  requestId: string;
  imageDataUrl: string;
  sourceLangHint?: string | null;
  timeoutMs: number;
};

export type OcrRuntimeErrorPayload = {
  code: OcrRuntimeErrorCode;
  message: string;
  retryable: boolean;
};

export type OcrRuntimeResponsePayload = {
  requestId: string;
  recognizedText?: string;
  error?: OcrRuntimeErrorPayload;
};

export function isOcrRuntimeRequestPayload(value: unknown): value is OcrRuntimeRequestPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.requestId === 'string' &&
    typeof record.imageDataUrl === 'string' &&
    typeof record.timeoutMs === 'number' &&
    (record.sourceLangHint === undefined ||
      record.sourceLangHint === null ||
      typeof record.sourceLangHint === 'string')
  );
}
