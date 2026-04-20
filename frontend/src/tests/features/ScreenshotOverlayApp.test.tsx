import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenshotOverlayApp } from '../../features/screenshot/ScreenshotOverlayApp';
import { DEFAULT_SETTINGS } from '../../features/settings/settingsTypes';
import {
  cacheScreenshotOverlayPayload,
  clearCachedScreenshotOverlayPayload,
} from '../../features/screenshot/screenshotOverlayBridge';

const {
  mockHide,
  mockShow,
  mockFocus,
  mockListen,
  mockLoadSettingsForTranslation,
  mockTriggerOcrRecognizeRegion,
  mockTriggerOcrTranslateRegion,
  mockShowOcrResultWindow,
  mockUpdateOcrResultWindow,
} = vi.hoisted(() => ({
  mockHide: vi.fn().mockResolvedValue(undefined),
  mockShow: vi.fn().mockResolvedValue(undefined),
  mockFocus: vi.fn().mockResolvedValue(undefined),
  mockListen: vi.fn().mockResolvedValue(() => undefined),
  mockLoadSettingsForTranslation: vi.fn(),
  mockTriggerOcrRecognizeRegion: vi.fn(),
  mockTriggerOcrTranslateRegion: vi.fn(),
  mockShowOcrResultWindow: vi.fn().mockResolvedValue(undefined),
  mockUpdateOcrResultWindow: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    hide: mockHide,
    show: mockShow,
    setFocus: mockFocus,
    listen: mockListen,
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../features/task/taskService', () => ({
  triggerOcrRecognizeRegion: mockTriggerOcrRecognizeRegion,
  triggerOcrTranslateRegion: mockTriggerOcrTranslateRegion,
}));

vi.mock('../../features/ocr/ocrResultWindowService', () => ({
  showOcrResultWindow: mockShowOcrResultWindow,
  updateOcrResultWindow: mockUpdateOcrResultWindow,
}));

vi.mock('../../features/settings/nativeSettingsStorage', () => ({
  loadSettingsForTranslation: mockLoadSettingsForTranslation,
}));

describe('ScreenshotOverlayApp', () => {
  beforeEach(() => {
    clearCachedScreenshotOverlayPayload();
    window.localStorage.clear();
    mockHide.mockClear();
    mockShow.mockClear();
    mockFocus.mockClear();
    mockListen.mockClear();
    mockLoadSettingsForTranslation.mockReset();
    mockTriggerOcrRecognizeRegion.mockReset();
    mockTriggerOcrTranslateRegion.mockReset();
    mockShowOcrResultWindow.mockClear();
    mockUpdateOcrResultWindow.mockClear();
    mockLoadSettingsForTranslation.mockResolvedValue(DEFAULT_SETTINGS);
    mockTriggerOcrRecognizeRegion.mockResolvedValue({
      action: 'succeeded',
      payload: {
        taskType: 'ocr_recognize',
        taskId: 'task_ocr_recognize_1',
        result: {
          taskId: 'task_ocr_recognize_1',
          providerId: 'apple_vision',
          sourceText: 'hello',
          recognizedText: 'hello',
        },
      },
    });
    mockTriggerOcrTranslateRegion.mockResolvedValue({
      action: 'succeeded',
      payload: {
        taskType: 'ocr_translate',
        taskId: 'task_ocr_translate_1',
        result: {
          taskId: 'task_ocr_translate_1',
          providerId: 'bing_web',
          sourceText: 'hello',
          recognizedText: 'hello',
          translatedText: '你好',
          translationResults: [{ providerId: 'bing_web', translatedText: '你好' }],
        },
      },
    });
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
  });

  it('reloads cached payload when the window regains focus', async () => {
    render(<ScreenshotOverlayApp />);

    expect(screen.queryByText('截图翻译')).not.toBeInTheDocument();

    cacheScreenshotOverlayPayload({
      mode: 'ocr_translate',
      sourceLanguageLabel: '英语',
      sourceLangHint: 'en',
      targetLanguageCode: 'zh-CN',
      targetLanguageLabel: '简体中文',
      targetLang: 'zh-CN',
      monitor: {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        scaleFactor: 1,
      },
    });

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(screen.getByText('截图翻译')).toBeInTheDocument();
    });
  });

  it('shows OCR result window after screenshot translate succeeds', async () => {
    mockLoadSettingsForTranslation.mockResolvedValueOnce({
      ...DEFAULT_SETTINGS,
      primaryLanguage: 'en',
      defaultTranslateProvider: 'bing_web',
    });

    cacheScreenshotOverlayPayload({
      mode: 'ocr_translate',
      sourceLanguageLabel: '英语',
      sourceLangHint: 'en',
      targetLanguageCode: 'zh-CN',
      targetLanguageLabel: '简体中文',
      targetLang: 'zh-CN',
      monitor: {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        scaleFactor: 1,
      },
    });

    render(<ScreenshotOverlayApp />);

    const overlay = screen.getByText('截图翻译').closest('main');
    if (!overlay) {
      throw new Error('missing screenshot overlay root');
    }

    await act(async () => {
      fireEvent.mouseDown(overlay, { clientX: 10, clientY: 10 });
      fireEvent.mouseMove(overlay, { clientX: 100, clientY: 80 });
      fireEvent.mouseUp(overlay, { clientX: 100, clientY: 80 });
    });

    await waitFor(() => {
      expect(mockTriggerOcrRecognizeRegion).toHaveBeenCalledTimes(1);
      expect(mockShowOcrResultWindow).toHaveBeenCalledTimes(1);
      expect(mockUpdateOcrResultWindow).toHaveBeenCalledTimes(1);
    });
    expect(mockTriggerOcrTranslateRegion).not.toHaveBeenCalled();
    expect(mockShowOcrResultWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        initialStatus: 'pending',
        mode: 'ocr_translate',
        pendingMessage: '正在识别...',
      }),
    );
    expect(mockUpdateOcrResultWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        autoTranslate: true,
        mode: 'ocr_translate',
        initialText: 'hello',
      }),
    );
  });

  it('prefers native settings over redacted local storage for OCR provider configs', async () => {
    window.localStorage.setItem(
      'lingoflow.settings.v1',
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        defaultOcrProvider: 'openai_compatible_ocr',
        providers: {
          ...DEFAULT_SETTINGS.providers,
          openai_compatible_ocr: {
            ...DEFAULT_SETTINGS.providers.openai_compatible_ocr,
            enabled: true,
            apiKey: '',
          },
        },
      }),
    );
    mockLoadSettingsForTranslation.mockResolvedValueOnce({
      ...DEFAULT_SETTINGS,
      defaultOcrProvider: 'openai_compatible_ocr',
      providers: {
        ...DEFAULT_SETTINGS.providers,
        openai_compatible_ocr: {
          ...DEFAULT_SETTINGS.providers.openai_compatible_ocr,
          enabled: true,
          apiKey: 'native-secret',
        },
      },
    });
    cacheScreenshotOverlayPayload({
      mode: 'ocr_translate',
      sourceLanguageLabel: '英语',
      sourceLangHint: 'en',
      targetLanguageCode: 'zh-CN',
      targetLanguageLabel: '简体中文',
      targetLang: 'zh-CN',
      monitor: {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        scaleFactor: 1,
      },
    });

    render(<ScreenshotOverlayApp />);

    const overlay = screen.getByText('截图翻译').closest('main');
    if (!overlay) {
      throw new Error('missing screenshot overlay root');
    }

    await act(async () => {
      fireEvent.mouseDown(overlay, { clientX: 10, clientY: 10 });
      fireEvent.mouseMove(overlay, { clientX: 100, clientY: 80 });
      fireEvent.mouseUp(overlay, { clientX: 100, clientY: 80 });
    });

    await waitFor(() => {
      expect(mockTriggerOcrRecognizeRegion).toHaveBeenCalledTimes(1);
    });
    expect(mockTriggerOcrRecognizeRegion).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'en',
      'openai_compatible_ocr',
      [
        {
          id: 'openai_compatible_ocr',
          apiKey: 'native-secret',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
        },
      ],
    );
  });
});
