import { fireEvent, render, screen } from '@testing-library/react';
import { OcrResultPanel } from '../../features/ocr/OcrResultPanel';

describe('OcrResultPanel', () => {
  it('renders editable workspace input and submits on Enter', () => {
    const onSubmit = vi.fn();
    const onTextChange = vi.fn();

    render(
      <OcrResultPanel
        autoQueryOnPaste={false}
        autoSelectTextOnOpen={false}
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
        enabledProviderIds={['deepl_free', 'google_translate']}
        preferredProviderId="deepl_free"
        rows={[
          { providerId: 'deepl_free', content: '采用 macOS Sonoma', isError: false },
          { providerId: 'google_translate', content: '借助 macOS Sonoma', isError: false },
        ]}
        sourceLanguageCode="en"
        sourceLanguageLabel="英语"
        status="success"
        text="with macOS sonoma"
        textSelectionToken="initial"
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
    const { container } = render(
      <OcrResultPanel
        autoQueryOnPaste={false}
        autoSelectTextOnOpen={false}
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
        enabledProviderIds={['deepl_free', 'google_translate', 'openai_compatible']}
        preferredProviderId="deepl_free"
        sourceLanguageCode="en"
        sourceLanguageLabel="英语"
        status="success"
        text="with macOS sonoma"
        textSelectionToken="initial"
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
    expect(screen.getByRole('heading', { name: '翻译结果' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '主结果' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '其他 Provider' })).not.toBeInTheDocument();

    const orderedRows = Array.from(container.querySelectorAll('[data-provider-row]')).map((node) =>
      node.getAttribute('data-provider-row'),
    );
    expect(orderedRows).toEqual(['deepl_free', 'google_translate', 'openai_compatible']);
    expect(container.querySelector('[data-provider-icon="deepl"]')).not.toBeNull();
    expect(container.querySelector('.ocrProviderMetaTopline')).not.toBeNull();
  });

  it('renders enabled providers even when there are no results yet', () => {
    const { container } = render(
      <OcrResultPanel
        autoQueryOnPaste={false}
        autoSelectTextOnOpen={false}
        errorMessage=""
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onTextChange={vi.fn()}
        onClear={vi.fn()}
        onTogglePin={vi.fn()}
        rows={[]}
        isPinned={false}
        onPromoteProvider={vi.fn()}
        onSourceLanguageChange={vi.fn()}
        onSwapLanguages={vi.fn()}
        onTargetLanguageChange={vi.fn()}
        enabledProviderIds={['youdao_web', 'bing_web', 'deepl_free']}
        preferredProviderId={null}
        sourceLanguageCode="en"
        sourceLanguageLabel="英语"
        status="idle"
        text=""
        textSelectionToken="empty"
        targetLanguageCode="zh-CN"
        targetLanguageLabel="简体中文"
      />,
    );

    const orderedRows = Array.from(container.querySelectorAll('[data-provider-row]')).map((node) =>
      node.getAttribute('data-provider-row'),
    );
    expect(orderedRows).toEqual(['deepl_free', 'bing_web', 'youdao_web']);
    expect(screen.queryByText('当前没有 Provider 结果。')).not.toBeInTheDocument();
    expect(screen.getAllByText('等待中').length).toBeGreaterThan(0);
  });
});
