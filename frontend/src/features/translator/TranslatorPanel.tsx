import { useState } from 'react';
import { TaskState } from '../task/taskTypes';

type TranslatorPanelProps = {
  taskState: TaskState;
  sourceLanguageLabel: string;
  targetLanguageLabel: string;
  onSwapLanguage: () => void;
};

type EngineCardProps = {
  title: string;
  content: string;
  muted?: boolean;
};

function normalizeDisplayText(text: string) {
  return text.replace(/\r\n/g, '\n').replace(/\t/g, '  ').trim();
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

function EngineCard({ title, content, muted }: EngineCardProps) {
  return (
    <article className={muted ? 'engineCard engineCardMuted' : 'engineCard'}>
      <header>
        <h4>{title}</h4>
      </header>
      <p>{content}</p>
    </article>
  );
}

function EmptyPanel() {
  return (
    <div className="panelEmpty">
      <strong>等待翻译任务</strong>
      <p>可使用上方按钮或托盘菜单触发输入翻译、划词翻译、截图翻译。</p>
    </div>
  );
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

  const sourceText = normalizeDisplayText(taskState.result?.sourceText ?? '');
  const translatedText = normalizeDisplayText(
    taskState.result?.translatedText ?? taskState.result?.recognizedText ?? '',
  );

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

      <EngineCard
        title={taskState.result.providerId}
        content={translatedText || 'Provider 未返回译文'}
      />
      <EngineCard title="内置 AI 翻译" content="待接入" muted />
      <EngineCard title="DeepL 翻译" content="待接入" muted />
    </article>
  );
}
