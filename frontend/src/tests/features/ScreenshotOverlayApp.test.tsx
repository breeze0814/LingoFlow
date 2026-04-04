import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenshotOverlayApp } from '../../features/screenshot/ScreenshotOverlayApp';
import {
  cacheScreenshotOverlayPayload,
  clearCachedScreenshotOverlayPayload,
} from '../../features/screenshot/screenshotOverlayBridge';

const { mockHide, mockShow, mockFocus, mockListen } = vi.hoisted(() => ({
  mockHide: vi.fn().mockResolvedValue(undefined),
  mockShow: vi.fn().mockResolvedValue(undefined),
  mockFocus: vi.fn().mockResolvedValue(undefined),
  mockListen: vi.fn().mockResolvedValue(() => undefined),
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

vi.mock('../../features/task/taskService', () => ({
  triggerOcrRecognizeRegion: vi.fn(),
  triggerOcrTranslateRegion: vi.fn(),
}));

vi.mock('../../features/ocr/ocrResultWindowService', () => ({
  showOcrResultWindow: vi.fn(),
}));

describe('ScreenshotOverlayApp', () => {
  beforeEach(() => {
    clearCachedScreenshotOverlayPayload();
    mockHide.mockClear();
    mockShow.mockClear();
    mockFocus.mockClear();
    mockListen.mockClear();
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
});
