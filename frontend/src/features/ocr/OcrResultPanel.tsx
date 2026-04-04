import { type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, useEffect, useState } from 'react';
import { providerLabel, providerMeta } from '../translator/providerMeta';
import { DisplayRow } from './ocrResultRows';
import { TranslationWorkspaceStatus } from './translationWorkspaceService';

type OcrResultPanelProps = {
  errorMessage: string;
  onClose: () => void;
  onSubmit: () => void;
  onTextChange: (text: string) => void;
  rows: DisplayRow[];
  sourceLanguageLabel: string;
  status: TranslationWorkspaceStatus;
  text: string;
  targetLanguageLabel: string;
};

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

type CopyHandler = (content: string, successMessage: string) => void;

function WorkspaceInputBlock(props: {
  onCopy: CopyHandler;
  onSubmit: () => void;
  onTextChange: (text: string) => void;
  status: TranslationWorkspaceStatus;
  text: string;
}) {
  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    if (props.status !== 'pending') {
      props.onSubmit();
    }
  }

  return (
    <section className="ocrSourceBlock">
      <header>
        <span>OCR 文本</span>
        <button
          type="button"
          className="iconButton"
          aria-label="复制 OCR 文本"
          onClick={() => props.onCopy(props.text, '已复制输入内容')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      </header>
      <textarea
        aria-label="翻译输入框"
        value={props.text}
        onChange={(event) => props.onTextChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入内容后按 Enter 翻译，Shift + Enter 换行"
      />
    </section>
  );
}

function OcrResultList(props: { rows: DisplayRow[]; onCopy: CopyHandler; status: TranslationWorkspaceStatus }) {
  if (props.status === 'pending') {
    return <div className="ocrResultLoading">正在翻译中...</div>;
  }
  if (props.rows.length === 0) {
    return <div className="ocrResultEmpty">输入内容后按 Enter 发起翻译。</div>;
  }
  return (
    <>
      {props.rows.map((item) => {
        const meta = providerMeta(item.providerId);
        const cardClass = item.isError ? 'ocrResultCard ocrResultCardError' : 'ocrResultCard';
        return (
          <article
            key={item.providerId}
            className={cardClass}
            style={{ '--provider-color': meta.color } as CSSProperties}
          >
            <header>
              <h4>
                <span style={{ fontSize: '16px' }}>{meta.icon}</span>
                <span>{meta.label}</span>
              </h4>
              {!item.isError ? (
                <button
                  type="button"
                  className="iconButton"
                  aria-label={`复制 ${meta.label} 结果`}
                  onClick={() => props.onCopy(item.content, `已复制 ${meta.label} 结果`)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              ) : null}
            </header>
            <p>{item.content}</p>
          </article>
        );
      })}
    </>
  );
}

function WorkspaceToolbar(props: { onClose: () => void; onCopyAll: () => void }) {
  return (
    <header className="ocrResultPanelHeader">
      <strong>翻译工作台</strong>
      <div className="ocrResultPanelActions">
        <button type="button" className="iconButton" aria-label="复制全部结果" onClick={props.onCopyAll}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        <button type="button" className="iconButton" aria-label="关闭窗口" onClick={props.onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </header>
  );
}

export function OcrResultPanel({
  errorMessage,
  onClose,
  onSubmit,
  onTextChange,
  rows,
  sourceLanguageLabel,
  status,
  text,
  targetLanguageLabel,
}: OcrResultPanelProps) {
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  function clearCopyMessageSoon() {
    window.setTimeout(() => setCopyMessage(''), 1200);
  }

  async function handleCopy(content: string, successMessage: string) {
    try {
      await copyToClipboard(content);
      setCopyMessage(successMessage);
      clearCopyMessageSoon();
      return;
    } catch (error) {
      setCopyMessage(`复制失败: ${String(error)}`);
    }
    clearCopyMessageSoon();
  }

  async function handleCopyAll() {
    const successRows = rows.filter((row) => !row.isError);
    if (successRows.length === 0 || !text.trim()) {
      setCopyMessage('没有可复制的翻译结果');
      clearCopyMessageSoon();
      return;
    }

    const parts: string[] = [];
    parts.push('OCR 文本：');
    parts.push(text);
    parts.push('');
    parts.push('翻译结果：');
    successRows.forEach((row) => {
      parts.push(`${providerLabel(row.providerId)}：${row.content}`);
    });

    const fullText = parts.join('\n');
    await handleCopy(fullText, '已复制全部结果');
  }

  return (
    <aside className="ocrResultPanel" role="dialog" aria-label="OCR 结果面板">
      <WorkspaceToolbar onClose={onClose} onCopyAll={handleCopyAll} />
      <WorkspaceInputBlock
        onCopy={handleCopy}
        onSubmit={onSubmit}
        onTextChange={onTextChange}
        status={status}
        text={text}
      />

      <section className="ocrResultLanguageRow">
        <span>{sourceLanguageLabel}</span>
        <span>⇄</span>
        <span>{targetLanguageLabel}</span>
      </section>

      {copyMessage ? <div className="ocrCopyTip">{copyMessage}</div> : null}
      {errorMessage ? <div className="ocrResultError">{errorMessage}</div> : null}

      <section className="ocrResultList">
        <OcrResultList rows={rows} onCopy={handleCopy} status={status} />
      </section>
    </aside>
  );
}
