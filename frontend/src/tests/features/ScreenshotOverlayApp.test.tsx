import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenshotOverlayApp } from '../../features/screenshot/ScreenshotOverlayApp';
import {
  cacheScreenshotOverlayPayload,
  clearCachedScreenshotOverlayPayload,
} from '../../features/screenshot/screenshotOverlayBridge';

const {
  mockHide,
  mockShow,
  mockFocus,
  mockListen,
  mockTriggerOcrRecognizeRegion,
  mockTriggerOcrTranslateRegion,
  mockShowOcrResultWindow,
} = vi.hoisted(() => ({
  mockHide: vi.fn().mockResolvedValue(undefined),
  mockShow: vi.fn().mockResolvedValue(undefined),
  mockFocus: vi.fn().mockResolvedValue(undefined),
  mockListen: vi.fn().mockResolvedValue(() => undefined),
  mockTriggerOcrRecognizeRegion: vi.fn(),
  mockTriggerOcrTranslateRegion: vi.fn(),
  mockShowOcrResultWindow: vi.fn().mockResolvedValue(undefined),
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
}));

describe('ScreenshotOverlayApp', () => {
  beforeEach(() => {
    clearCachedScreenshotOverlayPayload();
    mockHide.mockClear();
    mockShow.mockClear();
    mockFocus.mockClear();
    mockListen.mockClear();
    mockTriggerOcrRecognizeRegion.mockReset();
    mockTriggerOcrTranslateRegion.mockReset();
    mockShowOcrResultWindow.mockClear();
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
    window.localStorage.setItem(
      'lingoflow.settings.v1',
      JSON.stringify({
        primaryLanguage: 'en',
        secondaryLanguage: 'zh-CN',
        detectionMode: 'auto',
        ocrPanelPosition: 'top_right',
        clearInputOnTranslate: false,
        keepResultForSelection: true,
        autoSelectQueryTextOnOpen: false,
        autoQueryOnSelection: true,
        autoQueryOnOcr: true,
        autoQueryOnPaste: true,
        autoSpeakEnglishWord: false,
        englishVoice: 'us',
        autoCopyResult: false,
        httpApiEnabled: true,
        shortcuts: {
          inputTranslate: 'Option + F',
          ocrTranslate: 'Option + S',
          selectionTranslate: 'Option + D',
          ocrRecognize: 'Shift + Option + S',
          hideInterface: 'Option + Q',
          openSettings: 'Cmd/Ctrl + ,',
        },
        providers: {
          localOcr: {
            enabled: true,
            apiKey: '',
            baseUrl: '',
            model: '',
            region: '',
            secretId: '',
            secretKey: '',
            appId: '',
            appSecret: '',
          },
          youdao_web: {
            enabled: true,
            apiKey: '',
            baseUrl: '',
            model: '',
            region: '',
            secretId: '',
            secretKey: '',
            appId: '',
            appSecret: '',
          },
          bing_web: {
            enabled: true,
            apiKey: '',
            baseUrl: '',
            model: '',
            region: '',
            secretId: '',
            secretKey: '',
            appId: '',
            appSecret: '',
          },
          deepl_free: {
            enabled: false,
            apiKey: '',
            baseUrl: 'https://api-free.deepl.com/v2/translate',
            model: '',
            region: '',
            secretId: '',
            secretKey: '',
            appId: '',
            appSecret: '',
          },
          azure_translator: {
            enabled: false,
            apiKey: '',
            baseUrl: 'https://api.cognitive.microsofttranslator.com',
            model: '',
            region: '',
            secretId: '',
            secretKey: '',
            appId: '',
            appSecret: '',
          },
          google_translate: {
            enabled: false,
            apiKey: '',
            baseUrl: 'https://translation.googleapis.com/language/translate/v2',
            model: '',
            region: '',
            secretId: '',
            secretKey: '',
            appId: '',
            appSecret: '',
          },
          tencent_tmt: {
            enabled: false,
            apiKey: '',
            baseUrl: 'https://tmt.tencentcloudapi.com',
            model: '',
            region: 'ap-guangzhou',
            secretId: '',
            secretKey: '',
            appId: '',
            appSecret: '',
          },
          baidu_fanyi: {
            enabled: false,
            apiKey: '',
            baseUrl: 'https://fanyi-api.baidu.com/api/trans/vip/translate',
            model: '',
            region: '',
            secretId: '',
            secretKey: '',
            appId: '',
            appSecret: '',
          },
        },
      }),
    );

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
    });
    expect(mockTriggerOcrRecognizeRegion).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Object),
      'auto',
    );
    expect(mockTriggerOcrTranslateRegion).not.toHaveBeenCalled();
    expect(mockShowOcrResultWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        autoTranslate: true,
        mode: 'ocr_translate',
        initialText: 'hello',
      }),
    );
  });
});
