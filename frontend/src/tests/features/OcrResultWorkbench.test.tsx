import { act, render, waitFor } from '@testing-library/react';
import { applyPastedText, OcrResultWorkbench } from '../../features/ocr/OcrResultWorkbench';

const ORIGINAL_INNER_WIDTH = window.innerWidth;

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
    writable: true,
  });
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

function renderWorkbench() {
  return render(
    <OcrResultWorkbench
      autoQueryOnPaste={false}
      autoSelectTextOnOpen={false}
      copyMessage=""
      enabledProviderIds={['deepl_free', 'google_translate', 'bing_web']}
      errorMessage=""
      isPinned={false}
      onClear={vi.fn()}
      onClose={vi.fn()}
      onCopy={vi.fn()}
      onPromoteProvider={vi.fn()}
      onSourceLanguageChange={vi.fn()}
      onSubmit={vi.fn()}
      onSwapLanguages={vi.fn()}
      onTargetLanguageChange={vi.fn()}
      onTextChange={vi.fn()}
      onTogglePin={vi.fn()}
      preferredProviderId="deepl_free"
      rows={[
        { providerId: 'deepl_free', content: '采用 macOS Sonoma', isError: false },
        { providerId: 'google_translate', content: '借助 macOS Sonoma', isError: false },
      ]}
      sourceLanguageCode="en"
      sourceLanguageLabel="英语（自动检测）"
      status="success"
      targetLanguageCode="zh-CN"
      targetLanguageLabel="简体中文"
      text="with macOS sonoma"
      textSelectionToken="test"
    />,
  );
}

describe('OcrResultWorkbench', () => {
  afterEach(() => {
    setViewportWidth(ORIGINAL_INNER_WIDTH);
  });

  it('builds the next text content for paste-based auto submit', () => {
    expect(applyPastedText('hello world', 'dear ', 6, 6)).toBe('hello dear world');
    expect(applyPastedText('hello world', 'translator', 0, 11)).toBe('translator');
  });

  it('switches to condensed layout when the window narrows', async () => {
    setViewportWidth(460);
    const { container } = renderWorkbench();
    const root = container.firstElementChild;

    expect(root).toHaveClass('ocrCompactWindow');
    expect(root).not.toHaveClass('ocrCompactWindowCondensed');

    setViewportWidth(430);

    await waitFor(() => {
      expect(root).toHaveClass('ocrCompactWindowCondensed');
    });

    setViewportWidth(520);

    await waitFor(() => {
      expect(root).not.toHaveClass('ocrCompactWindowCondensed');
    });
  });
});
