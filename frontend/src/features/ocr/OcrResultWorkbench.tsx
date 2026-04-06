import {
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
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
  copyMessage: string;
  enabledProviderIds: string[];
  errorMessage: string;
  isPinned: boolean;
  onClear: () => void;
  onClose: () => void;
  onCopy: CopyHandler;
  onPromoteProvider: (providerId: string) => void;
  onSourceLanguageChange: (code: string) => void;
  onSubmit: () => void;
  onSwapLanguages: () => void;
  onTargetLanguageChange: (code: string) => void;
  onTextChange: (text: string) => void;
  onTogglePin: () => void;
  preferredProviderId: string | null;
  rows: DisplayRow[];
  sourceLanguageCode: string;
  sourceLanguageLabel: string;
  status: TranslationWorkspaceStatus;
  targetLanguageCode: string;
  targetLanguageLabel: string;
  text: string;
};

function LanguageMenu(props: {
  activeCode: string;
  activeLabel: string;
  isOpen: boolean;
  onSelect: (code: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="ocrLanguagePicker">
      <button type="button" className="ocrLanguageButton" onClick={props.onToggle}>
        {props.activeLabel}
      </button>
      {props.isOpen ? (
        <div className="ocrLanguageMenu">
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
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
}

function isCondensedWorkbenchWidth(viewportWidth: number) {
  return viewportWidth <= OCR_WORKBENCH_CONDENSED_MAX_WIDTH;
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

  return (
    <section
      className={
        isCondensedLayout ? 'ocrCompactWindow ocrCompactWindowCondensed' : 'ocrCompactWindow'
      }
    >
      <div className="ocrFixedSection">
        <div className="ocrLanguageStrip">
          <LanguageMenu
            activeCode={props.sourceLanguageCode}
            activeLabel={props.sourceLanguageLabel}
            isOpen={activeLanguageMenu === 'source'}
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
            placeholder="输入文本，按 Enter 翻译"
          />
          <div className="ocrInputActions">
            <TooltipIconButton
              ariaLabel="翻译"
              tooltip={props.status === 'pending' ? '翻译中...' : '翻译'}
              isPrimary
              size="small"
              onClick={props.onSubmit}
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
        {props.copyMessage ? <div className="ocrInlineMessage">{props.copyMessage}</div> : null}
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
