import { fireEvent, render, screen } from '@testing-library/react';
import { OcrResultPanel } from '../../features/ocr/OcrResultPanel';

describe('OcrResultPanel', () => {
  it('renders editable workspace input and submits on Enter', () => {
    const onSubmit = vi.fn();
    const onTextChange = vi.fn();

    render(
      <OcrResultPanel
        errorMessage=""
        isPinned
        onClear={vi.fn()}
        onClose={vi.fn()}
        onPromoteProvider={vi.fn()}
        onSourceLanguageChange={vi.fn()}
        onSubmit={onSubmit}
        onSwapLanguages={vi.fn()}
        onTargetLanguageChange={vi.fn()}
        onTextChange={onTextChange}
        onTogglePin={vi.fn()}
        preferredProviderId="deepl_free"
        rows={[
          { providerId: 'deepl_free', content: '采用 macOS Sonoma', isError: false },
          { providerId: 'google_translate', content: '借助 macOS Sonoma', isError: false },
        ]}
        sourceLanguageCode="en"
        sourceLanguageLabel="英语"
        status="success"
        text="with macOS sonoma"
        targetLanguageCode="zh-CN"
        targetLanguageLabel="简体中文"
      />,
    );

    expect(screen.getByLabelText('翻译输入框')).toBeInTheDocument();
    expect(screen.getByDisplayValue('with macOS sonoma')).not.toHaveAttribute('readonly');

    const textbox = screen.getByLabelText('翻译输入框');
    fireEvent.change(textbox, { target: { value: 'edited text' } });
    fireEvent.keyDown(textbox, { key: 'Enter' });

    expect(onTextChange).toHaveBeenCalledWith('edited text');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders comparison workspace sections for translation results', () => {
    render(
      <OcrResultPanel
        errorMessage=""
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onTextChange={vi.fn()}
        onClear={vi.fn()}
        onTogglePin={vi.fn()}
        rows={[
          { providerId: 'deepl_free', content: '采用 macOS Sonoma', isError: false },
          { providerId: 'google_translate', content: '借助 macOS Sonoma', isError: false },
          {
            providerId: 'openai_compatible',
            content: '配合 macOS Sonoma 使用',
            isError: false,
          },
        ]}
        isPinned={false}
        onPromoteProvider={vi.fn()}
        onSourceLanguageChange={vi.fn()}
        onSwapLanguages={vi.fn()}
        onTargetLanguageChange={vi.fn()}
        preferredProviderId="deepl_free"
        sourceLanguageCode="en"
        sourceLanguageLabel="英语"
        status="success"
        text="with macOS sonoma"
        targetLanguageCode="zh-CN"
        targetLanguageLabel="简体中文"
      />,
    );

    /* Icon buttons are identified by aria-label */
    expect(screen.getByRole('button', { name: '翻译' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '复制' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '清空' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '英语' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '简体中文' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '主结果' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '其他 Provider' })).toBeInTheDocument();
  });
});
