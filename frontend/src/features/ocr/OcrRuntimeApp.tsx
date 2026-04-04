import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  OCR_RUNTIME_REQUEST_EVENT,
  OcrRuntimeErrorPayload,
  OcrRuntimeRequestPayload,
  OcrRuntimeResponsePayload,
  isOcrRuntimeRequestPayload,
} from './ocrRuntimeBridge';
import {
  recognizeImageWithTesseract,
  terminateTesseractWorker,
} from './tesseractWorkerService';

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function buildErrorPayload(error: unknown): OcrRuntimeErrorPayload {
  const message = error instanceof Error ? error.message : String(error);
  return {
    code: 'provider_invalid_response',
    message,
    retryable: true,
  };
}

function buildSuccessPayload(requestId: string, recognizedText: string): OcrRuntimeResponsePayload {
  return {
    requestId,
    recognizedText,
  };
}

function buildFailurePayload(
  requestId: string,
  recognizedText: string,
  error: unknown,
): OcrRuntimeResponsePayload {
  if (recognizedText.length === 0) {
    return {
      requestId,
      error: {
        code: 'ocr_empty_result',
        message: 'Tesseract OCR returned empty text',
        retryable: false,
      },
    };
  }

  return {
    requestId,
    error: buildErrorPayload(error),
  };
}

async function submitOcrResponse(payload: OcrRuntimeResponsePayload) {
  await invoke('resolve_tesseract_ocr', { payload });
}

async function processOcrRequest(payload: OcrRuntimeRequestPayload) {
  let recognizedText = '';

  try {
    recognizedText = await recognizeImageWithTesseract(payload.imageDataUrl, payload.sourceLangHint);
    const response =
      recognizedText.length > 0
        ? buildSuccessPayload(payload.requestId, recognizedText)
        : buildFailurePayload(payload.requestId, recognizedText, new Error('empty result'));
    await submitOcrResponse(response);
  } catch (error) {
    await submitOcrResponse(buildFailurePayload(payload.requestId, recognizedText, error));
  }
}

export function OcrRuntimeApp() {
  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let cleanup: null | (() => void) = null;
    let disposed = false;

    async function bindRuntimeListener() {
      const currentWindow = getCurrentWindow();
      const unlisten = await currentWindow.listen<OcrRuntimeRequestPayload>(
        OCR_RUNTIME_REQUEST_EVENT,
        (event) => {
          if (!isOcrRuntimeRequestPayload(event.payload)) {
            return;
          }
          void processOcrRequest(event.payload);
        },
      );
      if (disposed) {
        unlisten();
        return;
      }
      cleanup = unlisten;
    }

    void bindRuntimeListener();
    return () => {
      disposed = true;
      if (cleanup) {
        cleanup();
      }
      void terminateTesseractWorker();
    };
  }, []);

  return null;
}
