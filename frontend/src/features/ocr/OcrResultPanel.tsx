import { useEffect, useRef, useState } from 'react';
import { DisplayRow } from './ocrResultRows';
import { OcrResultWorkbench } from './OcrResultWorkbench';
import { TranslationWorkspaceStatus } from './translationWorkspaceService';

type OcrResultPanelProps = {
  autoQueryOnPaste: boolean;
  autoSelectTextOnOpen: boolean;
  enabledProviderIds: string[];
  errorMessage: string;
  isPinned: boolean;
  onClear: () => void;
  onClose: () => void;
  onPromoteProvider: (providerId: string) => void;
  onSourceLanguageChange: (code: string) => void;
  onSubmit: (text?: string) => void;
  onSwapLanguages: () => void;
  onTargetLanguageChange: (code: string) => void;
  onTextChange: (text: string) => void;
  onTogglePin: () => void;
  preferredProviderId: string | null;
  rows: DisplayRow[];
  sourceLanguageCode: string;
  sourceLanguageLabel: string;
  status: TranslationWorkspaceStatus;
  text: string;
  textSelectionToken: string;
  targetLanguageCode: string;
  targetLanguageLabel: string;
};

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export function OcrResultPanel({
  autoQueryOnPaste,
  autoSelectTextOnOpen,
  enabledProviderIds,
  errorMessage,
  isPinned,
  onClear,
  onClose,
  onPromoteProvider,
  onSourceLanguageChange,
  onSubmit,
  onSwapLanguages,
  onTargetLanguageChange,
  onTextChange,
  onTogglePin,
  preferredProviderId,
  rows,
  sourceLanguageCode,
  sourceLanguageLabel,
  status,
  text,
  textSelectionToken,
  targetLanguageCode,
  targetLanguageLabel,
}: OcrResultPanelProps) {
  const [copyMessage, setCopyMessage] = useState('');
  const copyMessageTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (copyMessageTimeoutRef.current === null) {
        return;
      }
      window.clearTimeout(copyMessageTimeoutRef.current);
    };
  }, []);

  function clearPendingCopyMessageTimer() {
    if (copyMessageTimeoutRef.current === null) {
      return;
    }
    window.clearTimeout(copyMessageTimeoutRef.current);
    copyMessageTimeoutRef.current = null;
  }

  function clearCopyMessageSoon() {
    clearPendingCopyMessageTimer();
    copyMessageTimeoutRef.current = window.setTimeout(() => {
      setCopyMessage('');
      copyMessageTimeoutRef.current = null;
    }, 1200);
  }

  async function handleCopy(content: string, successMessage: string) {
    try {
      await copyToClipboard(content);
      setCopyMessage(successMessage);
    } catch (error) {
      setCopyMessage(`复制失败: ${String(error)}`);
    }
    clearCopyMessageSoon();
  }

  return (
    <aside className="ocrResultPanel" role="dialog" aria-label="OCR 结果面板">
      <OcrResultWorkbench
        autoQueryOnPaste={autoQueryOnPaste}
        autoSelectTextOnOpen={autoSelectTextOnOpen}
        copyMessage={copyMessage}
        enabledProviderIds={enabledProviderIds}
        errorMessage={errorMessage}
        isPinned={isPinned}
        onClear={onClear}
        onClose={onClose}
        onCopy={handleCopy}
        onPromoteProvider={onPromoteProvider}
        onSourceLanguageChange={onSourceLanguageChange}
        onSubmit={onSubmit}
        onSwapLanguages={onSwapLanguages}
        onTargetLanguageChange={onTargetLanguageChange}
        onTextChange={onTextChange}
        onTogglePin={onTogglePin}
        preferredProviderId={preferredProviderId}
        rows={rows}
        sourceLanguageCode={sourceLanguageCode}
        sourceLanguageLabel={sourceLanguageLabel}
        status={status}
        targetLanguageCode={targetLanguageCode}
        targetLanguageLabel={targetLanguageLabel}
        text={text}
        textSelectionToken={textSelectionToken}
      />
    </aside>
  );
}
