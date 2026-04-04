import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OcrResultWindowApp } from '../../features/ocr/OcrResultWindowApp';
import { cacheOcrResultPayload, clearCachedOcrResultPayload } from '../../features/ocr/ocrResultWindowBridge';

const {
  mockHide,
  mockListen,
  mockInputTranslate,
} = vi.hoisted(() => ({
  mockHide: vi.fn().mockResolvedValue(undefined),
  mockListen: vi.fn().mockResolvedValue(() => undefined),
  mockInputTranslate: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    hide: mockHide,
    listen: mockListen,
  }),
}));

vi.mock('../../infra/tauri/commands', () => ({
  commandsClient: {
    inputTranslate: mockInputTranslate,
  },
}));

describe('OcrResultWindowApp', () => {
  beforeEach(() => {
    clearCachedOcrResultPayload();
    mockHide.mockClear();
    mockListen.mockClear();
    mockInputTranslate.mockReset();
    mockInputTranslate.mockResolvedValue({
      ok: true,
      task_id: 'task_window_1',
      status: 'success',
      data: {
        provider_id: 'google_translate',
        source_text: 'edited text',
        translated_text: '编辑后的文本',
        translation_results: [
          {
            provider_id: 'google_translate',
            translated_text: '编辑后的文本',
          },
        ],
      },
    });
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
  });

  it('submits edited text from the workspace input on Enter', async () => {
    cacheOcrResultPayload({
      autoTranslate: false,
      initialText: 'with macOS sonoma',
      mode: 'ocr_recognize',
      sourceLanguageLabel: '英语',
      targetLanguageCode: 'zh-CN',
      targetLanguageLabel: '简体中文',
    });

    render(<OcrResultWindowApp />);

    const textbox = screen.getByLabelText('翻译输入框');
    fireEvent.change(textbox, { target: { value: 'edited text' } });
    fireEvent.keyDown(textbox, { key: 'Enter' });

    await waitFor(() => {
      expect(mockInputTranslate).toHaveBeenCalledTimes(1);
    });
    expect(mockInputTranslate).toHaveBeenCalledWith({
      targetLang: 'zh-CN',
      text: 'edited text',
    });
  });
});
