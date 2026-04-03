import { useEffect, useState } from 'react';
import { TaskResult } from '../task/taskTypes';
import { providerLabel, providerMeta } from '../translator/providerMeta';

type DisplayRow = {
  providerId: string;
  content: string;
  isError: boolean;
  isLoading?: boolean;
};

type OcrResultPanelProps = {
  result: TaskResult;
  sourceLanguageLabel: string;
  targetLanguageLabel: string;
  onClose: () => void;
};

function normalizeDisplayText(text: string) {
  return text.replace(/\r\n/g, '\n').replace(/\t/g, '  ').trim();
}

function buildRows(result: TaskResult): DisplayRow[] {
  if (result.translationResults && result.translationResults.length > 0) {
    return result.translationResults.map((item) => {
      if (item.error) {
        return {
          providerId: item.providerId,
          content: `${item.error.message} (${item.error.code})`,
          isError: true,
        };
      }
      return {
        providerId: item.providerId,
        content: normalizeDisplayText(item.translatedText ?? 'Provider 未返回译文'),
        isError: false,
      };
    });
  }
  if (result.translatedText) {
    return [
      {
        providerId: result.providerId,
        content: normalizeDisplayText(result.translatedText),
        isError: false,
      },
    ];
  }
  return [];
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

type CopyHandler = (content: string, successMessage: string) => void;

function OcrSourceBlock(props: { sourceText: string; onCopy: CopyHandler }) {
  return (
    <section className="ocrSourceBlock">
      <header>
        <span>OCR 文本</span>
        <button
          type="button"
          className="iconButton"
          aria-label="复制 OCR 文本"
          onClick={() => props.onCopy(props.sourceText, '已复制 OCR 文本')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      </header>
      <textarea readOnly value={props.sourceText} />
    </section>
  );
}

function OcrResultList(props: { rows: DisplayRow[]; onCopy: CopyHandler; isLoading?: boolean }) {
  if (props.isLoading) {
    return <div className="ocrResultLoading">正在翻译中...</div>;
  }
  if (props.rows.length === 0) {
    return <div className="ocrResultEmpty">当前没有可展示的翻译结果。</div>;
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
            style={{ '--provider-color': meta.color } as React.CSSProperties}
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

export function OcrResultPanel({
  result,
  sourceLanguageLabel,
  targetLanguageLabel,
  onClose,
}: OcrResultPanelProps) {
  const [copyMessage, setCopyMessage] = useState('');
  const sourceText = normalizeDisplayText(result.sourceText ?? '');
  const rows = buildRows(result);
  const isLoading = rows.length === 0 && !result.translatedText && !result.translationResults;

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
    if (successRows.length === 0) {
      setCopyMessage('没有可复制的翻译结果');
      clearCopyMessageSoon();
      return;
    }

    const parts: string[] = [];
    parts.push('OCR 文本：');
    parts.push(sourceText);
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

      <OcrSourceBlock sourceText={sourceText} onCopy={handleCopy} />

      <section className="ocrResultLanguageRow">
        <span>{sourceLanguageLabel}</span>
        <span>⇄</span>
        <span>{targetLanguageLabel}</span>
      </section>


      {copyMessage ? <div className="ocrCopyTip">{copyMessage}</div> : null}

      <section className="ocrResultList">
        <OcrResultList rows={rows} onCopy={handleCopy} isLoading={isLoading} />
      </section>
    </aside>
  );
}
