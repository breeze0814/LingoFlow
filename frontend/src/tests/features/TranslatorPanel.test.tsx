import { render, screen } from '@testing-library/react';
import { TranslatorPanel } from '../../features/translator/TranslatorPanel';

describe('TranslatorPanel', () => {
  it('renders empty state', () => {
    render(
      <TranslatorPanel
        taskState={{
          taskId: null,
          taskType: null,
          status: 'idle',
          result: null,
          error: null,
        }}
        sourceLanguageLabel="简体中文"
        targetLanguageLabel="英语"
        onSwapLanguage={vi.fn()}
      />,
    );
    expect(screen.getByText('等待翻译任务')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(
      <TranslatorPanel
        taskState={{
          taskId: 'task_1',
          taskType: 'input_translate',
          status: 'failure',
          result: null,
          error: {
            code: 'provider_not_configured',
            message: 'No translate provider configured',
            retryable: false,
          },
        }}
        sourceLanguageLabel="简体中文"
        targetLanguageLabel="英语"
        onSwapLanguage={vi.fn()}
      />,
    );
    expect(screen.getByText('任务失败')).toBeInTheDocument();
  });
});
