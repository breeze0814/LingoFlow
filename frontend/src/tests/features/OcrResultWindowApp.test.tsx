import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OcrResultWindowApp } from '../../features/ocr/OcrResultWindowApp';
import {
  cacheOcrResultPayload,
  clearCachedOcrResultPayload,
} from '../../features/ocr/ocrResultWindowBridge';
import { DEFAULT_SETTINGS } from '../../features/settings/settingsTypes';

const { mockHide, mockListen, mockInputTranslate, mockLoadSettings } = vi.hoisted(() => ({
  mockHide: vi.fn().mockResolvedValue(undefined),
  mockListen: vi.fn().mockResolvedValue(() => undefined),
  mockInputTranslate: vi.fn(),
  mockLoadSettings: vi.fn(),
}));

const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
const speechCancel = vi.fn();
const speechSpeak = vi.fn();
const textareaSelect = vi.spyOn(HTMLTextAreaElement.prototype, 'select');

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    hide: mockHide,
    listen: mockListen,
  }),
}));

vi.mock('../../infra/tauri/commands', () => ({
  commandsClient: {
    inputTranslate: mockInputTranslate,
    loadSettings: mockLoadSettings,
  },
}));

describe('OcrResultWindowApp', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearCachedOcrResultPayload();
    mockHide.mockClear();
    mockListen.mockClear();
    mockInputTranslate.mockReset();
    mockLoadSettings.mockReset();
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
    mockLoadSettings.mockImplementation(async () => {
      const raw = window.localStorage.getItem('lingoflow.settings.v1');
      return raw ? JSON.parse(raw) : null;
    });
    clipboardWriteText.mockClear();
    speechCancel.mockClear();
    speechSpeak.mockClear();
    textareaSelect.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel: speechCancel,
        speak: speechSpeak,
      },
    });
    Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: class SpeechSynthesisUtterance {
        lang = '';
        text: string;

        constructor(text: string) {
          this.text = text;
        }
      },
    });
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
  });

  it('submits edited text from the workspace input on Enter', async () => {
    window.localStorage.setItem(
      'lingoflow.settings.v1',
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        providers: {
          ...DEFAULT_SETTINGS.providers,
          youdao_web: { ...DEFAULT_SETTINGS.providers.youdao_web, enabled: true },
          bing_web: { ...DEFAULT_SETTINGS.providers.bing_web, enabled: true },
          deepl_free: {
            ...DEFAULT_SETTINGS.providers.deepl_free,
            enabled: true,
            apiKey: 'deepl-key',
          },
        },
      }),
    );

    cacheOcrResultPayload({
      autoTranslate: false,
      initialText: 'with macOS sonoma',
      mode: 'input_translate',
      sourceLanguageCode: 'en',
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
      sourceLang: 'en',
      targetLang: 'zh-CN',
      text: 'edited text',
      translateProviderConfigs: [
        { id: 'youdao_web' },
        { id: 'bing_web' },
        {
          id: 'deepl_free',
          apiKey: 'deepl-key',
          baseUrl: 'https://api-free.deepl.com/v2/translate',
        },
      ],
    });
  });

  it('auto translates OCR results with auto detection enabled', async () => {
    window.localStorage.setItem(
      'lingoflow.settings.v1',
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        detectionMode: 'auto',
        primaryLanguage: 'en',
      }),
    );

    cacheOcrResultPayload({
      autoTranslate: true,
      initialText: 'hello',
      mode: 'ocr_recognize',
      result: {
        taskId: 'ocr_task_1',
        providerId: 'apple_vision',
        sourceText: 'hello',
        recognizedText: 'hello',
      },
      sourceLanguageCode: 'en',
      sourceLanguageLabel: '英语',
      targetLanguageCode: 'zh-CN',
      targetLanguageLabel: '简体中文',
    });

    render(<OcrResultWindowApp />);

    await waitFor(() => {
      expect(mockInputTranslate).toHaveBeenCalledTimes(1);
    });
    expect(mockInputTranslate).toHaveBeenCalledWith({
      sourceLang: 'auto',
      targetLang: 'zh-CN',
      text: 'hello',
      translateProviderConfigs: [{ id: 'youdao_web' }, { id: 'bing_web' }],
    });
  });

  it('clears the input after a successful manual translation when enabled', async () => {
    window.localStorage.setItem(
      'lingoflow.settings.v1',
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        clearInputOnTranslate: true,
      }),
    );

    cacheOcrResultPayload({
      autoTranslate: false,
      initialText: 'keep me',
      mode: 'input_translate',
      sourceLanguageCode: 'en',
      sourceLanguageLabel: '英语',
      targetLanguageCode: 'zh-CN',
      targetLanguageLabel: '简体中文',
    });

    render(<OcrResultWindowApp />);

    const textbox = screen.getByLabelText('翻译输入框') as HTMLTextAreaElement;
    fireEvent.keyDown(textbox, { key: 'Enter' });

    await waitFor(() => {
      expect(mockInputTranslate).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(textbox.value).toBe('');
    });
  });

  it('auto selects existing text on open when enabled', async () => {
    window.localStorage.setItem(
      'lingoflow.settings.v1',
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        autoSelectQueryTextOnOpen: true,
      }),
    );

    cacheOcrResultPayload({
      autoTranslate: false,
      initialText: 'select me',
      mode: 'input_translate',
      sourceLanguageCode: 'en',
      sourceLanguageLabel: '英语',
      targetLanguageCode: 'zh-CN',
      targetLanguageLabel: '简体中文',
    });

    render(<OcrResultWindowApp />);

    await waitFor(() => {
      expect(textareaSelect).toHaveBeenCalledTimes(1);
    });
  });

  it('auto copies translated text and speaks an english word when enabled', async () => {
    window.localStorage.setItem(
      'lingoflow.settings.v1',
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        autoCopyResult: true,
        autoSpeakEnglishWord: true,
        englishVoice: 'uk',
      }),
    );

    cacheOcrResultPayload({
      autoTranslate: false,
      initialText: 'hello',
      mode: 'ocr_translate',
      result: {
        taskId: 'ocr_task_2',
        providerId: 'deepl_free',
        sourceText: 'hello',
        translatedText: '你好',
        translationResults: [
          {
            providerId: 'deepl_free',
            translatedText: '你好',
          },
        ],
      },
      sourceLanguageCode: 'en',
      sourceLanguageLabel: '英语',
      targetLanguageCode: 'zh-CN',
      targetLanguageLabel: '简体中文',
    });

    render(<OcrResultWindowApp />);

    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith('你好');
      expect(speechCancel).toHaveBeenCalledTimes(1);
      expect(speechSpeak).toHaveBeenCalledTimes(1);
    });
    expect((speechSpeak.mock.calls[0]?.[0] as { lang: string }).lang).toBe('en-GB');
  });
});
