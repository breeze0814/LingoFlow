import { MouseEvent, useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { OcrResultPanel } from './OcrResultPanel';
import {
  OCR_RESULT_UPDATE_EVENT,
  OcrResultWindowPayload,
  cacheOcrResultPayload,
  clearCachedOcrResultPayload,
  isOcrResultWindowPayload,
  readCachedOcrResultPayload,
} from './ocrResultWindowBridge';

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function OcrResultWindowApp() {
  const [payload, setPayload] = useState<OcrResultWindowPayload | null>(() =>
    readCachedOcrResultPayload(),
  );
  const [listenError, setListenError] = useState('');

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
          result={payload.result}
          sourceLanguageLabel={payload.sourceLanguageLabel}
          targetLanguageLabel={payload.targetLanguageLabel}
          onClose={() => {
            void hideCurrentWindow(true);
          }}
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
