import {
  KeyboardEvent as ReactKeyboardEvent,
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LANGUAGE_OPTIONS } from '../settings/settingsTypes';
import { DisplayRow } from './ocrResultRows';
import { TranslationWorkspaceStatus } from './translationWorkspaceService';
import {
  CopyHandler,
  buildResultState,
  providerMark,
  statusLabel,
} from './ocrResultWorkbenchModel';

type OcrResultWorkbenchProps = {
  copyMessage: string;
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

/* ── SVG Icon Components ── */

function IconTranslate() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 8l6 6" />
      <path d="M4 14l6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2v3" />
      <path d="M22 22l-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconErase() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 21h10" />
      <path d="M5.636 5.636a9 9 0 0 0 0 12.728l.707.707L12 13.414l5.657 5.657.707-.707a9 9 0 0 0 0-12.728L12 12 5.636 5.636z" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconChevronUp() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

/* ── Tooltip Icon Button ── */

function TooltipIconButton(props: {
  ariaLabel: string;
  children: React.ReactNode;
  isActive?: boolean;
  isPrimary?: boolean;
  onClick: () => void;
  tooltip: string;
  size?: 'normal' | 'small';
}) {
  const classNames = [
    'ocrIconBtn',
    props.size === 'small' ? 'ocrIconBtnSmall' : '',
    props.isPrimary ? 'ocrIconBtnPrimary' : '',
    props.isActive ? 'ocrIconBtnActive' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={classNames}
      aria-label={props.ariaLabel}
      data-tooltip={props.tooltip}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

/* ── Language Menu (unchanged logic) ── */

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

/* ── Mini icon actions for result cards ── */

function ResultActions(props: { canCopy: boolean; onCopy?: () => void; onPromote?: () => void }) {
  return (
    <div className="ocrMiniActions">
      {props.canCopy && props.onCopy ? (
        <TooltipIconButton ariaLabel="复制" tooltip="复制" size="small" onClick={props.onCopy}>
          <IconCopy />
        </TooltipIconButton>
      ) : null}
      {props.onPromote ? (
        <TooltipIconButton
          ariaLabel="设为主 Provider"
          tooltip="设为首选"
          size="small"
          onClick={props.onPromote}
        >
          <IconStar />
        </TooltipIconButton>
      ) : null}
    </div>
  );
}

/* ── Main Workbench ── */

export function OcrResultWorkbench(props: OcrResultWorkbenchProps) {
  const resultState = useMemo(
    () => buildResultState(props.rows, props.preferredProviderId),
    [props.preferredProviderId, props.rows],
  );
  const featuredState = resultState.providerStates.find(
    (item) => item.providerId === resultState.featuredRow?.providerId,
  );
  const [activeLanguageMenu, setActiveLanguageMenu] = useState<'source' | 'target' | null>(null);
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
  const [isMainExpanded, setIsMainExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autoResizeTextarea();
  }, [autoResizeTextarea, props.text]);

  /* reset expanded secondary on result change */
  useEffect(() => {
    setExpandedResultId(null);
  }, [resultState.featuredRow?.providerId]);

  function handleTextKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    if (props.status !== 'pending') {
      props.onSubmit();
    }
  }

  function handleCopyPrimary() {
    const content = resultState.featuredRow?.content ?? props.text;
    const label = resultState.featuredRow ? '已复制主结果' : '已复制输入内容';
    props.onCopy(content, label);
  }

  return (
    <section className="ocrCompactWindow">
      <div className="ocrFixedSection">
        {/* ── Row 1: Language strip ── */}
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

        {/* ── Row 2: Textarea with embedded actions ── */}
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
              onClick={handleCopyPrimary}
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

        {/* ── Primary Result ── */}
        <section className="ocrSectionCard">
          <header className="ocrSectionHeader">
            <h3>主结果</h3>
            <span>{statusLabel(props.status)}</span>
          </header>
          {resultState.featuredRow ? (
            <article className="ocrPrimaryResult">
              <header className="ocrPrimaryResultHeader">
                <div>
                  <strong>{featuredState?.label ?? '未选择 Provider'}</strong>
                  <span>{featuredState?.statusLabel ?? '待输入'}</span>
                </div>
                <ResultActions
                  canCopy={!resultState.featuredRow.isError}
                  onCopy={() => props.onCopy(resultState.featuredRow!.content, '已复制主结果')}
                />
              </header>
              <p
                className={
                  isMainExpanded ? 'ocrResultText' : 'ocrResultText ocrResultTextCollapsed'
                }
              >
                {resultState.featuredRow.content}
              </p>
              {resultState.featuredRow.content.length > 90 ? (
                <TooltipIconButton
                  ariaLabel={isMainExpanded ? '收起' : '展开'}
                  tooltip={isMainExpanded ? '收起' : '展开全文'}
                  size="small"
                  onClick={() => setIsMainExpanded(!isMainExpanded)}
                >
                  {isMainExpanded ? <IconChevronUp /> : <IconChevronDown />}
                </TooltipIconButton>
              ) : null}
            </article>
          ) : (
            <div className="ocrEmptyState">修改文本或切换语言后，点击翻译生成主结果。</div>
          )}
        </section>

        {/* ── Secondary Results ── */}
        <section className="ocrSectionCard">
          <header className="ocrSectionHeader">
            <h3>其他 Provider</h3>
            <span>{resultState.secondaryRows.length}</span>
          </header>
          {resultState.secondaryRows.length > 0 ? (
            <div className="ocrSecondaryList">
              {resultState.secondaryRows.map((row) => {
                const item = resultState.providerStates.find(
                  (provider) => provider.providerId === row.providerId,
                );
                const isExpanded = expandedResultId === row.providerId;
                return (
                  <article key={row.providerId} className="ocrSecondaryItem">
                    <button
                      type="button"
                      className="ocrSecondarySummary"
                      onClick={() => setExpandedResultId(isExpanded ? null : row.providerId)}
                    >
                      <span
                        className="ocrProviderBadge"
                        style={{ '--provider-color': item?.color } as CSSProperties}
                      >
                        {providerMark(row.providerId)}
                      </span>
                      <span className="ocrProviderMeta">
                        <strong>{item?.label ?? row.providerId}</strong>
                        <span>{row.isError ? '失败' : '已返回'}</span>
                      </span>
                      <span className="ocrDisclosure">
                        {isExpanded ? <IconChevronUp /> : <IconChevronDown />}
                      </span>
                    </button>
                    {isExpanded ? (
                      <div className="ocrSecondaryBody">
                        <p>{row.content}</p>
                        <ResultActions
                          canCopy={!row.isError}
                          onCopy={
                            !row.isError
                              ? () =>
                                  props.onCopy(
                                    row.content,
                                    `已复制 ${item?.label ?? row.providerId} 结果`,
                                  )
                              : undefined
                          }
                          onPromote={() => props.onPromoteProvider(row.providerId)}
                        />
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="ocrEmptyState">当前没有其他 Provider 结果。</div>
          )}
        </section>
      </div>
    </section>
  );
}
