import { render, screen } from '@testing-library/react';
import { OcrResultPanel } from '../../features/ocr/OcrResultPanel';

describe('OcrResultPanel', () => {
  it('renders OCR text and provider results in order', () => {
    render(
      <OcrResultPanel
        result={{
          taskId: 'task_ocr_1',
          providerId: 'google_translate',
          sourceText: 'with macOS sonoma',
          recognizedText: 'with macOS sonoma',
          translationResults: [
            { providerId: 'youdao_web', translatedText: '通过 macOS Sonoma' },
            { providerId: 'google_translate', translatedText: '借助 macOS Sonoma' },
          ],
        }}
        sourceLanguageLabel="英语"
        targetLanguageLabel="简体中文"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('OCR 文本')).toBeInTheDocument();
    expect(screen.getByDisplayValue('with macOS sonoma')).toBeInTheDocument();
    expect(screen.getByText('有道翻译')).toBeInTheDocument();
    expect(screen.getByText('Google 翻译')).toBeInTheDocument();
    expect(screen.getByText('通过 macOS Sonoma')).toBeInTheDocument();
    expect(screen.getByText('借助 macOS Sonoma')).toBeInTheDocument();
  });
});
