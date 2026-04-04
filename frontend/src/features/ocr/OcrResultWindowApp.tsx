import { MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { OcrResultPanel } from './OcrResultPanel';
import { buildDisplayRows } from './ocrResultRows';
import {
  OCR_RESULT_UPDATE_EVENT,
  OcrResultWindowPayload,
  cacheOcrResultPayload,
  clearCachedOcrResultPayload,
  isOcrResultWindowPayload,
  readCachedOcrResultPayload,
} from './ocrResultWindowBridge';
import {
  createTranslationWorkspaceState,
  submitTranslationWorkspaceText,
  type TranslationWorkspaceState,
} from './translationWorkspaceService';

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function buildCachedPayload(
  payload: OcrResultWindowPayload,
  state: TranslationWorkspaceState,
): OcrResultWindowPayload {
  return {
    ...payload,
    autoTranslate: false,
    initialText: state.text,
    result: state.result ?? undefined,
  };
}

export function OcrResultWindowApp() {
  const [payload, setPayload] = useState<OcrResultWindowPayload | null>(() =>
    readCachedOcrResultPayload(),
  );
  const [workspaceState, setWorkspaceState] = useState<TranslationWorkspaceState>(() =>
    createTranslationWorkspaceState(readCachedOcrResultPayload()),
  );
  const [listenError, setListenError] = useState('');
  const autoTranslateTokenRef = useRef('');

  useEffect(() => {
    setWorkspaceState(createTranslationWorkspaceState(payload));
    autoTranslateTokenRef.current = '';
  }, [payload]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }
    let cleanup: null | (() => void) = null;
    let disposed = false;

    async function bindResultListener() {
      try {
        const currentWindow = getCurrentWindow();
        const unlisten = await currentWindow.listen<OcrResultWindowPayload>(
          OCR_RESULT_UPDATE_EVENT,
          (event) => {
            if (!isOcrResultWindowPayload(event.payload)) {
              return;
            }
            cacheOcrResultPayload(event.payload);
            setPayload(event.payload);
          },
        );
        if (disposed) {
          unlisten();
          return;
        }
        cleanup = unlisten;
      } catch (error) {
        const message = `绑定 OCR 结果事件失败: ${String(error)}`;
        console.error(message, error);
        setListenError(message);
      }
    }

    void bindResultListener();
    return () => {
      disposed = true;
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  async function hideCurrentWindow(clearPayload: boolean) {
    if (clearPayload) {
      clearCachedOcrResultPayload();
      setPayload(null);
    }
    try {
      await getCurrentWindow().hide();
    } catch (error) {
      console.error('failed to hide OCR result window', error);
    }
  }

  const handleSubmit = useCallback(async (nextText?: string) => {
    if (!payload) {
      return;
    }

    const text = nextText ?? workspaceState.text;
    setWorkspaceState((current) => ({
      ...current,
      errorMessage: '',
      result: null,
      status: 'pending',
      text,
    }));

    const nextState = await submitTranslationWorkspaceText(payload, text);
    const resolvedState = {
      ...workspaceState,
      ...nextState,
      text,
    };

    setWorkspaceState((current) => ({
      ...current,
      ...nextState,
      text,
    }));

    const nextPayload = buildCachedPayload(payload, resolvedState);
    cacheOcrResultPayload(nextPayload);
    setPayload(nextPayload);
  }, [payload, workspaceState]);

  useEffect(() => {
    if (!payload || !payload.autoTranslate || !payload.initialText.trim()) {
      return;
    }
    const token = `${payload.mode}:${payload.initialText}:${payload.targetLanguageCode}`;
    if (autoTranslateTokenRef.current === token) {
      return;
    }
    autoTranslateTokenRef.current = token;
    void handleSubmit(payload.initialText);
  }, [handleSubmit, payload]);

  function handleRootMouseDown(event: MouseEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }
    void hideCurrentWindow(true);
  }

  if (payload) {
    return (
      <main className="ocrResultWindowRoot" onMouseDown={handleRootMouseDown}>
        <OcrResultPanel
          errorMessage={workspaceState.errorMessage}
          onClose={() => {
            void hideCurrentWindow(true);
          }}
          onSubmit={() => {
            void handleSubmit();
          }}
          onTextChange={(text) => {
            setWorkspaceState((current) => ({
              ...current,
              text,
            }));
          }}
          rows={buildDisplayRows(workspaceState.result)}
          sourceLanguageLabel={payload.sourceLanguageLabel}
          status={workspaceState.status}
          text={workspaceState.text}
          targetLanguageLabel={payload.targetLanguageLabel}
        />
      </main>
    );
  }

  return (
    <main className="ocrResultWindowRoot">
      <section className="ocrResultWindowEmpty">
        <strong>等待 OCR 结果</strong>
        <p>{listenError || '请从托盘触发“截图翻译”或“静默截图 OCR”。'}</p>
      </section>
    </main>
  );
}
