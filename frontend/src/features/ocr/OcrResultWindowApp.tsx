import { MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LANGUAGE_OPTIONS } from '../settings/settingsTypes';
import { buildEnabledTranslateProviderIds } from '../settings/translateProviderRequest';
import { loadSettingsFromStorage } from '../settings/settingsStorage';
import {
  englishVoiceLocale,
  selectPrimaryTranslatedText,
  selectSpokenEnglishWord,
} from '../settings/settingsRuntime';
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
import { isTauriRuntime } from '../../app/appRuntime';

type WorkspaceDirection = {
  sourceLanguageCode: string;
  sourceLanguageLabel: string;
  targetLanguageCode: string;
  targetLanguageLabel: string;
};

function languageLabel(code: string): string {
  const found = LANGUAGE_OPTIONS.find((item) => item.value === code);
  return found ? found.label : code;
}

function buildDirection(payload: OcrResultWindowPayload | null): WorkspaceDirection {
  if (!payload) {
    return {
      sourceLanguageCode: 'auto',
      sourceLanguageLabel: '自动检测',
      targetLanguageCode: 'zh-CN',
      targetLanguageLabel: '简体中文',
    };
  }
  return {
    sourceLanguageCode: payload.sourceLanguageCode,
    sourceLanguageLabel: payload.sourceLanguageLabel,
    targetLanguageCode: payload.targetLanguageCode,
    targetLanguageLabel: payload.targetLanguageLabel,
  };
}

function buildCachedPayload(
  payload: OcrResultWindowPayload,
  state: TranslationWorkspaceState,
  direction: WorkspaceDirection,
  preferredProviderId: string | null,
): OcrResultWindowPayload {
  return {
    ...payload,
    autoTranslate: false,
    initialText: state.text,
    preferredProviderId: preferredProviderId ?? undefined,
    result: state.result ?? undefined,
    sourceLanguageCode: direction.sourceLanguageCode,
    sourceLanguageLabel: direction.sourceLanguageLabel,
    targetLanguageCode: direction.targetLanguageCode,
    targetLanguageLabel: direction.targetLanguageLabel,
  };
}

function clearedWorkspaceState(text: string): TranslationWorkspaceState {
  return {
    errorMessage: '',
    result: null,
    status: 'idle',
    text,
  };
}

function createTextSelectionToken(payload: OcrResultWindowPayload | null): string {
  if (!payload) {
    return '';
  }
  return [
    payload.mode,
    payload.result?.taskId ?? '',
    payload.initialText,
    payload.initialErrorMessage ?? '',
  ].join(':');
}

async function copyTranslatedResult(text: string) {
  await navigator.clipboard.writeText(text);
}

function speakEnglishWord(word: string, locale: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    throw new Error('speechSynthesis is unavailable');
  }
  if (typeof SpeechSynthesisUtterance === 'undefined') {
    throw new Error('SpeechSynthesisUtterance is unavailable');
  }
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = locale;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function OcrResultWindowApp() {
  const initialPayload = readCachedOcrResultPayload();
  const runtimeSettings = loadSettingsFromStorage();
  const [payload, setPayload] = useState<OcrResultWindowPayload | null>(initialPayload);
  const [workspaceState, setWorkspaceState] = useState<TranslationWorkspaceState>(() =>
    createTranslationWorkspaceState(initialPayload),
  );
  const [direction, setDirection] = useState<WorkspaceDirection>(() =>
    buildDirection(initialPayload),
  );
  const [preferredProviderId, setPreferredProviderId] = useState<string | null>(
    initialPayload?.preferredProviderId ?? initialPayload?.result?.providerId ?? null,
  );
  const [isPinned, setIsPinned] = useState(true);
  const [listenError, setListenError] = useState('');
  const autoTranslateTokenRef = useRef('');
  const automationTaskIdRef = useRef('');
  const enabledProviderIds = buildEnabledTranslateProviderIds(runtimeSettings.providers);
  const textSelectionToken = createTextSelectionToken(payload);

  useEffect(() => {
    setWorkspaceState(createTranslationWorkspaceState(payload));
    setDirection(buildDirection(payload));
    setPreferredProviderId(payload?.preferredProviderId ?? payload?.result?.providerId ?? null);
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

  const syncCachedPayload = useCallback(
    (
      nextState: TranslationWorkspaceState,
      nextDirection = direction,
      nextProviderId = preferredProviderId,
    ) => {
      if (!payload) {
        return;
      }
      const nextPayload = buildCachedPayload(payload, nextState, nextDirection, nextProviderId);
      cacheOcrResultPayload(nextPayload);
      setPayload(nextPayload);
    },
    [direction, payload, preferredProviderId],
  );

  const handleSubmit = useCallback(
    async (nextText?: string) => {
      if (!payload) {
        return;
      }
      const text = nextText ?? workspaceState.text;
      const settings = loadSettingsFromStorage();
      setWorkspaceState((current) => ({
        ...current,
        errorMessage: '',
        result: null,
        status: 'pending',
        text,
      }));
      const nextState = await submitTranslationWorkspaceText(payload, text, {
        sourceLanguageCode: direction.sourceLanguageCode,
        targetLanguageCode: direction.targetLanguageCode,
      });
      const resolvedText =
        payload.mode === 'input_translate' &&
        settings.clearInputOnTranslate &&
        nextState.status === 'success'
          ? ''
          : text;
      const resolvedState = { ...workspaceState, ...nextState, text: resolvedText };
      setWorkspaceState((current) => ({ ...current, ...nextState, text: resolvedText }));
      syncCachedPayload(resolvedState);
    },
    [
      direction.sourceLanguageCode,
      direction.targetLanguageCode,
      payload,
      syncCachedPayload,
      workspaceState,
    ],
  );

  useEffect(() => {
    if (!payload || !payload.autoTranslate || !payload.initialText.trim()) {
      return;
    }
    const token = [
      payload.mode,
      payload.initialText,
      payload.sourceLanguageCode,
      payload.targetLanguageCode,
    ].join(':');
    if (autoTranslateTokenRef.current === token) {
      return;
    }
    autoTranslateTokenRef.current = token;
    void handleSubmit(payload.initialText);
  }, [handleSubmit, payload]);

  useEffect(() => {
    const result = workspaceState.result;
    if (!result || automationTaskIdRef.current === result.taskId) {
      return;
    }

    const settings = loadSettingsFromStorage();
    const textToCopy = settings.autoCopyResult
      ? selectPrimaryTranslatedText(result, preferredProviderId)
      : null;
    const wordToSpeak = settings.autoSpeakEnglishWord ? selectSpokenEnglishWord(result) : null;
    if (!textToCopy && !wordToSpeak) {
      return;
    }

    automationTaskIdRef.current = result.taskId;
    if (textToCopy) {
      void copyTranslatedResult(textToCopy).catch((error) => {
        console.error('failed to auto copy translation result', error);
      });
    }
    if (wordToSpeak) {
      try {
        speakEnglishWord(wordToSpeak, englishVoiceLocale(settings.englishVoice));
      } catch (error) {
        console.error('failed to auto speak english word', error);
      }
    }
  }, [preferredProviderId, workspaceState.result]);

  function handleRootMouseDown(event: MouseEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }
    void hideCurrentWindow(true);
  }

  function updateDirection(nextDirection: WorkspaceDirection) {
    setDirection(nextDirection);
    const nextState = clearedWorkspaceState(workspaceState.text);
    setWorkspaceState(nextState);
    syncCachedPayload(nextState, nextDirection);
  }

  async function handleTogglePin() {
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    if (!isTauriRuntime()) {
      return;
    }
    try {
      const currentWindow = getCurrentWindow() as {
        setAlwaysOnTop?: (value: boolean) => Promise<void>;
      };
      if (currentWindow.setAlwaysOnTop) {
        await currentWindow.setAlwaysOnTop(nextPinned);
      }
    } catch (error) {
      setIsPinned(!nextPinned);
      console.error('failed to toggle always-on-top', error);
    }
  }

  function handlePromoteProvider(providerId: string) {
    setPreferredProviderId(providerId);
    syncCachedPayload(workspaceState, direction, providerId);
  }

  function handleSourceLanguageChange(code: string) {
    updateDirection({
      ...direction,
      sourceLanguageCode: code,
      sourceLanguageLabel: languageLabel(code),
    });
  }

  function handleTargetLanguageChange(code: string) {
    updateDirection({
      ...direction,
      targetLanguageCode: code,
      targetLanguageLabel: languageLabel(code),
    });
  }

  function handleSwapLanguages() {
    updateDirection({
      sourceLanguageCode: direction.targetLanguageCode,
      sourceLanguageLabel: direction.targetLanguageLabel,
      targetLanguageCode: direction.sourceLanguageCode,
      targetLanguageLabel: direction.sourceLanguageLabel,
    });
  }

  function handleClear() {
    const nextState = clearedWorkspaceState('');
    setWorkspaceState(nextState);
    syncCachedPayload(nextState);
  }

  if (payload) {
    return (
      <main className="ocrResultWindowRoot" onMouseDown={handleRootMouseDown}>
        <OcrResultPanel
          autoQueryOnPaste={runtimeSettings.autoQueryOnPaste}
          autoSelectTextOnOpen={runtimeSettings.autoSelectQueryTextOnOpen}
          enabledProviderIds={enabledProviderIds}
          errorMessage={workspaceState.errorMessage}
          isPinned={isPinned}
          onClear={handleClear}
          onClose={() => {
            void hideCurrentWindow(true);
          }}
          onPromoteProvider={handlePromoteProvider}
          onSourceLanguageChange={handleSourceLanguageChange}
          onSubmit={() => {
            void handleSubmit();
          }}
          onSwapLanguages={handleSwapLanguages}
          onTargetLanguageChange={handleTargetLanguageChange}
          onTextChange={(text) => {
            setWorkspaceState((current) => ({
              ...current,
              text,
            }));
          }}
          onTogglePin={() => {
            void handleTogglePin();
          }}
          preferredProviderId={preferredProviderId}
          rows={buildDisplayRows(workspaceState.result)}
          sourceLanguageCode={direction.sourceLanguageCode}
          sourceLanguageLabel={direction.sourceLanguageLabel}
          status={workspaceState.status}
          targetLanguageCode={direction.targetLanguageCode}
          targetLanguageLabel={direction.targetLanguageLabel}
          text={workspaceState.text}
          textSelectionToken={textSelectionToken}
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
