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

  it('renders multi-provider translation results', () => {
    render(
      <TranslatorPanel
        taskState={{
          taskId: 'task_2',
          taskType: 'ocr_translate',
          status: 'success',
          result: {
            taskId: 'task_2',
            providerId: 'google_translate',
            sourceText: 'hello world',
            translatedText: '你好，世界',
            recognizedText: 'hello world',
            translationResults: [
              { providerId: 'google_translate', translatedText: '你好，世界' },
              { providerId: 'deepl_free', translatedText: '你好世界' },
            ],
          },
          error: null,
        }}
        sourceLanguageLabel="英语"
        targetLanguageLabel="简体中文"
        onSwapLanguage={vi.fn()}
      />,
    );
    expect(screen.getByText('Google 翻译')).toBeInTheDocument();
    expect(screen.getByText('DeepL 翻译')).toBeInTheDocument();
    expect(screen.getByText('你好，世界')).toBeInTheDocument();
    expect(screen.getByText('你好世界')).toBeInTheDocument();
  });
});
