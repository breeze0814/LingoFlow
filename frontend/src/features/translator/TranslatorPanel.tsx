import { useState } from 'react';
import { TaskResult, TaskState } from '../task/taskTypes';
import { providerLabel } from './providerMeta';

type TranslatorPanelProps = {
  taskState: TaskState;
  sourceLanguageLabel: string;
  targetLanguageLabel: string;
  onSwapLanguage: () => void;
};

type EngineCardProps = {
  providerId: string;
  content: string;
  isError: boolean;
  onCopy: (text: string) => Promise<void>;
};

type DisplayResult = {
  providerId: string;
  content: string;
  isError: boolean;
};

function normalizeDisplayText(text: string) {
  return text.replace(/\r\n/g, '\n').replace(/\t/g, '  ').trim();
}

function buildDisplayResults(result: TaskResult): DisplayResult[] {
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
  const content = normalizeDisplayText(result.translatedText ?? result.recognizedText ?? '');
  if (!content) {
    return [];
  }
  return [
    {
      providerId: result.providerId,
      content,
      isError: false,
    },
  ];
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

function EngineCard({ providerId, content, isError, onCopy }: EngineCardProps) {
  const cardClass = isError ? 'engineCard engineCardError' : 'engineCard';
  return (
    <article className={cardClass} data-provider={providerId}>
      <header>
        <h4>{providerLabel(providerId)}</h4>
        {!isError ? (
          <button type="button" onClick={() => onCopy(content)}>
            复制
          </button>
        ) : null}
      </header>
      <p>{content}</p>
    </article>
  );
}

function EmptyPanel() {
  return null;
}

function ErrorPanel({ taskState }: { taskState: TaskState }) {
  return (
    <article className="panel panelError">
      <h2>任务失败</h2>
      <p>{taskState.error?.message}</p>
      <small>错误码: {taskState.error?.code}</small>
    </article>
  );
}

export function TranslatorPanel({
  taskState,
  sourceLanguageLabel,
  targetLanguageLabel,
  onSwapLanguage,
}: TranslatorPanelProps) {
  const [copyMessage, setCopyMessage] = useState('');

  if (taskState.error) {
    return <ErrorPanel taskState={taskState} />;
  }

  if (!taskState.result) {
    return <EmptyPanel />;
  }

  const sourceText = normalizeDisplayText(taskState.result.sourceText ?? '');
  const displayResults = buildDisplayResults(taskState.result);

  async function handleCopy(content: string, successMessage: string) {
    try {
      await copyToClipboard(content);
      setCopyMessage(successMessage);
    } catch (error) {
      setCopyMessage(`复制失败: ${String(error)}`);
    }
    window.setTimeout(() => setCopyMessage(''), 1200);
  }

  return (
    <article className="translatorPanel">
      <section className="sourceCard">
        <header>
          <strong>原文</strong>
          <div className="sourceActions">
            <button type="button" onClick={() => handleCopy(sourceText, '已复制原文')}>
              复制原文
            </button>
            <button type="button" onClick={onSwapLanguage}>
              互换语言
            </button>
          </div>
        </header>
        <p>{sourceText}</p>
      </section>

      <section className="languageRow">
        <span>{sourceLanguageLabel}</span>
        <span>⇄</span>
        <span>{targetLanguageLabel}</span>
      </section>

      {copyMessage ? <div className="copyTip">{copyMessage}</div> : null}

      <section className="engineList">
        {displayResults.map((item) => (
          <EngineCard
            key={item.providerId}
            providerId={item.providerId}
            content={item.content}
            isError={item.isError}
            onCopy={(text) => handleCopy(text, `已复制 ${providerLabel(item.providerId)} 结果`)}
          />
        ))}
      </section>
    </article>
  );
}
