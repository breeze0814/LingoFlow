import {
  ClipboardEvent as ReactClipboardEvent,
  KeyboardEvent as ReactKeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LANGUAGE_OPTIONS } from '../settings/settingsTypes';
import { DisplayRow } from './ocrResultRows';
import { OcrProviderResults } from './OcrProviderResults';
import { IconCopy, IconErase, IconTranslate, TooltipIconButton } from './OcrWorkbenchIcons';
import { buildResultState, CopyHandler } from './ocrResultWorkbenchModel';
import { TranslationWorkspaceStatus } from './translationWorkspaceService';

const OCR_WORKBENCH_CONDENSED_MAX_WIDTH = 440;

type OcrResultWorkbenchProps = {
  autoQueryOnPaste: boolean;
  autoSelectTextOnOpen: boolean;
  copyMessage: string;
  enabledProviderIds: string[];
  errorMessage: string;
  isPinned: boolean;
  onClear: () => void;
  onClose: () => void;
  onCopy: CopyHandler;
  onPromoteProvider: (providerId: string) => void;
  onSourceLanguageChange: (code: string) => void;
  onSubmit: (text?: string) => void;
  onSwapLanguages: () => void;
  onTargetLanguageChange: (code: string) => void;
  onTextChange: (text: string) => void;
  onTogglePin: () => void;
  pendingMessage?: string;
  preferredProviderId: string | null;
  rows: DisplayRow[];
  sourceLanguageCode: string;
  sourceLanguageLabel: string;
  status: TranslationWorkspaceStatus;
  targetLanguageCode: string;
  targetLanguageLabel: string;
  text: string;
  textSelectionToken: string;
};

const LanguageMenu = memo(function LanguageMenu(props: {
  activeCode: string;
  activeLabel: string;
  isOpen: boolean;
  menuId: string;
  onSelect: (code: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="ocrLanguagePicker">
      <button
        type="button"
        className="ocrLanguageButton"
        aria-controls={props.menuId}
        aria-expanded={props.isOpen}
        aria-haspopup="listbox"
        onClick={props.onToggle}
      >
        {props.activeLabel}
      </button>
      {props.isOpen ? (
        <div id={props.menuId} className="ocrLanguageMenu" role="listbox">
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === props.activeCode}
              className={
                option.value === props.activeCode
                  ? 'ocrLanguageOption ocrLanguageOptionActive'
                  : 'ocrLanguageOption'
              }
              onClick={() => props.onSelect(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
});

function isCondensedWorkbenchWidth(viewportWidth: number) {
  return viewportWidth <= OCR_WORKBENCH_CONDENSED_MAX_WIDTH;
}

export function applyPastedText(
  currentText: string,
  pastedText: string,
  selectionStart: number,
  selectionEnd: number,
) {
  return currentText.slice(0, selectionStart) + pastedText + currentText.slice(selectionEnd);
}

function readCondensedLayoutState() {
  if (typeof window === 'undefined') {
    return false;
  }
  return isCondensedWorkbenchWidth(window.innerWidth);
}

function useCondensedWorkbenchLayout() {
  const [isCondensedLayout, setIsCondensedLayout] = useState(readCondensedLayoutState);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    function syncLayoutMode() {
      setIsCondensedLayout(readCondensedLayoutState());
    }

    window.addEventListener('resize', syncLayoutMode);
    syncLayoutMode();

    return () => {
      window.removeEventListener('resize', syncLayoutMode);
    };
  }, []);

  return isCondensedLayout;
}

export function OcrResultWorkbench(props: OcrResultWorkbenchProps) {
  const resultState = useMemo(
    () => buildResultState(props.rows, props.preferredProviderId, props.enabledProviderIds),
    [props.enabledProviderIds, props.preferredProviderId, props.rows],
  );
  const [activeLanguageMenu, setActiveLanguageMenu] = useState<'source' | 'target' | null>(null);
  const sourceMenuId = useId();
  const targetMenuId = useId();
  const languageStripRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isCondensedLayout = useCondensedWorkbenchLayout();

  const autoResizeTextarea = useCallback(() => {
    const element = textareaRef.current;
    if (!element) {
      return;
    }
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autoResizeTextarea();
  }, [autoResizeTextarea, props.text]);

  useEffect(() => {
    if (!props.autoSelectTextOnOpen) {
      return;
    }
    const element = textareaRef.current;
    if (!element) {
      return;
    }
    window.setTimeout(() => {
      element.focus();
      if (element.value) {
        element.select();
      }
    }, 0);
  }, [props.autoSelectTextOnOpen, props.textSelectionToken]);

  useEffect(() => {
    if (!activeLanguageMenu) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (languageStripRef.current?.contains(event.target as Node)) {
        return;
      }
      setActiveLanguageMenu(null);
    }

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setActiveLanguageMenu(null);
    }

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscapeKey, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscapeKey, true);
    };
  }, [activeLanguageMenu]);

  function handleTextKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    if (props.status !== 'pending') {
      props.onSubmit();
    }
  }

  function handleCopyInput() {
    props.onCopy(props.text, '已复制输入内容');
  }

  function handlePaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    if (!props.autoQueryOnPaste || props.status === 'pending') {
      return;
    }
    const pastedText = event.clipboardData.getData('text');
    const nextText = pastedText
      ? applyPastedText(
          props.text,
          pastedText,
          event.currentTarget.selectionStart,
          event.currentTarget.selectionEnd,
        )
      : event.currentTarget.value;
    props.onSubmit(nextText);
  }

  return (
    <section
      className={
        isCondensedLayout ? 'ocrCompactWindow ocrCompactWindowCondensed' : 'ocrCompactWindow'
      }
    >
      <div className="ocrFixedSection">
        <div ref={languageStripRef} className="ocrLanguageStrip">
          <LanguageMenu
            activeCode={props.sourceLanguageCode}
            activeLabel={props.sourceLanguageLabel}
            isOpen={activeLanguageMenu === 'source'}
            menuId={sourceMenuId}
            onSelect={(code) => {
              props.onSourceLanguageChange(code);
              setActiveLanguageMenu(null);
            }}
            onToggle={() =>
              setActiveLanguageMenu(activeLanguageMenu === 'source' ? null : 'source')
            }
          />
          <button
            type="button"
            className="ocrSwapButton"
            aria-label="互换语言"
            onClick={props.onSwapLanguages}
          >
            ⇄
          </button>
          <LanguageMenu
            activeCode={props.targetLanguageCode}
            activeLabel={props.targetLanguageLabel}
            isOpen={activeLanguageMenu === 'target'}
            menuId={targetMenuId}
            onSelect={(code) => {
              props.onTargetLanguageChange(code);
              setActiveLanguageMenu(null);
            }}
            onToggle={() =>
              setActiveLanguageMenu(activeLanguageMenu === 'target' ? null : 'target')
            }
          />
        </div>

        <div className="ocrInputWrapper">
          <textarea
            ref={textareaRef}
            aria-label="翻译输入框"
            className="ocrCompactInput"
            value={props.text}
            onChange={(event) => props.onTextChange(event.target.value)}
            onKeyDown={handleTextKeyDown}
            onPaste={handlePaste}
            placeholder="输入文本，按 Enter 翻译"
          />
          <div className="ocrInputActions">
            <TooltipIconButton
              ariaLabel="翻译"
              tooltip={props.status === 'pending' ? '翻译中...' : '翻译'}
              disabled={props.status === 'pending'}
              isPrimary
              size="small"
              onClick={() => props.onSubmit()}
            >
              <IconTranslate />
            </TooltipIconButton>
            <TooltipIconButton
              ariaLabel="复制"
              tooltip="复制"
              size="small"
              onClick={handleCopyInput}
            >
              <IconCopy />
            </TooltipIconButton>
            <TooltipIconButton
              ariaLabel="清空"
              tooltip="清空输入"
              size="small"
              onClick={props.onClear}
            >
              <IconErase />
            </TooltipIconButton>
          </div>
        </div>
      </div>

      <div className="ocrScrollableSection">
        {props.copyMessage ? (
          <div className="ocrInlineMessage" role="status" aria-live="polite" aria-atomic="true">
            {props.copyMessage}
          </div>
        ) : null}
        {props.status === 'pending' ? (
          <div className="ocrInlineMessage" role="status" aria-live="polite" aria-atomic="true">
            {props.pendingMessage ?? '正在翻译...'}
          </div>
        ) : null}
        {props.errorMessage ? (
          <div className="ocrInlineMessage ocrInlineMessageError" role="alert">
            {props.errorMessage}
          </div>
        ) : null}

        <OcrProviderResults
          onCopy={props.onCopy}
          onPromoteProvider={props.onPromoteProvider}
          resultState={resultState}
        />
      </div>
    </section>
  );
}
