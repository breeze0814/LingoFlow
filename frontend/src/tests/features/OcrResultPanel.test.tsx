import { fireEvent, render, screen } from '@testing-library/react';
import { OcrResultPanel } from '../../features/ocr/OcrResultPanel';

describe('OcrResultPanel', () => {
  it('renders editable workspace input and submits on Enter', () => {
    const onSubmit = vi.fn();
    const onTextChange = vi.fn();

    render(
      <OcrResultPanel
        errorMessage=""
        onClose={vi.fn()}
        onSubmit={onSubmit}
        onTextChange={onTextChange}
        rows={[
          { providerId: 'deepl_free', content: '采用 macOS Sonoma', isError: false },
          { providerId: 'google_translate', content: '借助 macOS Sonoma', isError: false },
        ]}
        sourceLanguageLabel="英语"
        status="success"
        text="with macOS sonoma"
        targetLanguageLabel="简体中文"
      />,
    );

    expect(screen.getByText('OCR 文本')).toBeInTheDocument();
    expect(screen.getByDisplayValue('with macOS sonoma')).not.toHaveAttribute('readonly');

    const textbox = screen.getByLabelText('翻译输入框');
    fireEvent.change(textbox, { target: { value: 'edited text' } });
    fireEvent.keyDown(textbox, { key: 'Enter' });

    expect(onTextChange).toHaveBeenCalledWith('edited text');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
