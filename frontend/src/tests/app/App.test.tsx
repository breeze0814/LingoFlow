import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../app/App';
import { DEFAULT_SETTINGS } from '../../features/settings/settingsTypes';

const {
  mockShowOcrResultWindow,
  mockShowCachedOcrResultWindow,
  mockPrimeOcrResultWindowService,
  mockShowScreenshotOverlay,
  mockPrimeScreenshotOverlayService,
  mockReadSelectionText,
  mockTriggerOcrRecognize,
  mockMainWindowShow,
  mockMainWindowHide,
  mockMainWindowUnminimize,
  mockMainWindowSetFocus,
  mockSyncNativeShortcuts,
  mockSyncRuntimeSettings,
  mockTrayListeners,
  mockListen,
} = vi.hoisted(() => ({
  mockShowOcrResultWindow: vi.fn().mockResolvedValue(undefined),
  mockShowCachedOcrResultWindow: vi.fn().mockResolvedValue(undefined),
  mockPrimeOcrResultWindowService: vi.fn().mockResolvedValue(undefined),
  mockShowScreenshotOverlay: vi.fn().mockResolvedValue(undefined),
  mockPrimeScreenshotOverlayService: vi.fn().mockResolvedValue(undefined),
  mockReadSelectionText: vi.fn(),
  mockTriggerOcrRecognize: vi.fn(),
  mockMainWindowShow: vi.fn().mockResolvedValue(undefined),
  mockMainWindowHide: vi.fn().mockResolvedValue(undefined),
  mockMainWindowUnminimize: vi.fn().mockResolvedValue(undefined),
  mockMainWindowSetFocus: vi.fn().mockResolvedValue(undefined),
  mockSyncNativeShortcuts: vi.fn().mockResolvedValue(undefined),
  mockSyncRuntimeSettings: vi.fn().mockResolvedValue(undefined),
  mockTrayListeners: [] as Array<(event: { payload: unknown }) => void>,
  mockListen: vi.fn().mockImplementation(async (_eventName, handler) => {
    mockTrayListeners.push(handler as (event: { payload: unknown }) => void);
    return () => undefined;
  }),
}));

vi.mock('../../features/ocr/ocrResultWindowService', () => ({
  showOcrResultWindow: mockShowOcrResultWindow,
  showCachedOcrResultWindow: mockShowCachedOcrResultWindow,
  primeOcrResultWindowService: mockPrimeOcrResultWindowService,
}));

vi.mock('../../features/screenshot/screenshotOverlayService', () => ({
  showScreenshotOverlay: mockShowScreenshotOverlay,
  primeScreenshotOverlayService: mockPrimeScreenshotOverlayService,
}));

vi.mock('../../infra/tauri/commands', () => ({
  commandsClient: {
    readSelectionText: mockReadSelectionText,
  },
}));

vi.mock('../../features/task/taskService', async () => {
  const actual = await vi.importActual<typeof import('../../features/task/taskService')>(
    '../../features/task/taskService',
  );
  return {
    ...actual,
    triggerOcrRecognize: mockTriggerOcrRecognize,
  };
});

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    show: mockMainWindowShow,
    hide: mockMainWindowHide,
    unminimize: mockMainWindowUnminimize,
    setFocus: mockMainWindowSetFocus,
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
}));

vi.mock('../../features/settings/nativeShortcutSyncService', () => ({
  syncNativeShortcuts: mockSyncNativeShortcuts,
}));

vi.mock('../../features/settings/runtimeSettingsSyncService', () => ({
  syncRuntimeSettings: mockSyncRuntimeSettings,
}));

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockShowOcrResultWindow.mockClear();
    mockShowCachedOcrResultWindow.mockClear();
    mockPrimeOcrResultWindowService.mockClear();
    mockShowScreenshotOverlay.mockClear();
    mockPrimeScreenshotOverlayService.mockClear();
    mockReadSelectionText.mockReset();
    mockReadSelectionText.mockResolvedValue({ selectedText: 'selected text' });
    mockTriggerOcrRecognize.mockReset();
    mockTriggerOcrRecognize.mockResolvedValue({
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
    mockMainWindowShow.mockClear();
    mockMainWindowHide.mockClear();
    mockMainWindowUnminimize.mockClear();
    mockMainWindowSetFocus.mockClear();
    mockSyncNativeShortcuts.mockClear();
    mockSyncRuntimeSettings.mockClear();
    mockListen.mockClear();
    mockTrayListeners.length = 0;
    delete (window as Window & { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__;
  });

  it('renders settings tabs', () => {
    render(<App />);
    expect(screen.getByRole('tab', { name: '工具' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '通用' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '服务' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '高级' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '隐私' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '关于' })).not.toBeInTheDocument();
  });

  it('keeps shortcut-only behavior on main page', () => {
    render(<App />);
    expect(screen.queryByRole('button', { name: '输入翻译' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '截图翻译' })).not.toBeInTheDocument();
    expect(screen.queryByText('Settings Hub')).not.toBeInTheDocument();
    expect(screen.queryByText('LingoFlow')).not.toBeInTheDocument();
  });

  it('triggers shortcut action after modifiers are released', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'f', code: 'KeyF', altKey: true });
    expect(mockShowOcrResultWindow).not.toHaveBeenCalled();

    fireEvent.keyUp(window, { key: 'f', code: 'KeyF', altKey: true });
    expect(mockShowOcrResultWindow).not.toHaveBeenCalled();

    fireEvent.keyUp(window, { key: 'Alt', code: 'AltLeft', altKey: false });
    expect(mockShowOcrResultWindow).toHaveBeenCalledTimes(1);
  });

  it('opens OCR result window immediately after screenshot OCR for translate workflow', async () => {
    render(<App />);

    fireEvent.keyDown(window, { key: 's', code: 'KeyS', altKey: true });
    fireEvent.keyUp(window, { key: 's', code: 'KeyS', altKey: true });
    fireEvent.keyUp(window, { key: 'Alt', code: 'AltLeft', altKey: false });

    await waitFor(() => {
      expect(mockTriggerOcrRecognize).toHaveBeenCalledTimes(1);
      expect(mockShowOcrResultWindow).toHaveBeenCalledTimes(1);
    });
    expect(mockShowOcrResultWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        autoTranslate: true,
        mode: 'ocr_translate',
        initialText: 'hello',
      }),
    );
  });

  it('uses auto source language hint for OCR recognize when detection mode is auto', async () => {
    window.localStorage.setItem(
      'lingoflow.settings.v1',
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        primaryLanguage: 'en',
        detectionMode: 'auto',
      }),
    );

    render(<App />);

    fireEvent.keyDown(window, { key: 'S', code: 'KeyS', altKey: true, shiftKey: true });
    fireEvent.keyUp(window, { key: 'S', code: 'KeyS', altKey: true, shiftKey: true });
    fireEvent.keyUp(window, { key: 'Shift', code: 'ShiftLeft', altKey: true, shiftKey: false });
    fireEvent.keyUp(window, { key: 'Alt', code: 'AltLeft', altKey: false, shiftKey: false });

    await waitFor(() => {
      expect(mockTriggerOcrRecognize).toHaveBeenCalledTimes(1);
    });
    expect(mockTriggerOcrRecognize).toHaveBeenCalledWith(expect.anything(), 'auto');
  });

  it('opens selection text in the compact workspace and auto translates when enabled', async () => {
    window.localStorage.setItem(
      'lingoflow.settings.v1',
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        primaryLanguage: 'en',
        detectionMode: 'auto',
        autoQueryOnSelection: true,
      }),
    );

    render(<App />);

    fireEvent.keyDown(window, { key: 'd', code: 'KeyD', altKey: true });
    fireEvent.keyUp(window, { key: 'd', code: 'KeyD', altKey: true });
    fireEvent.keyUp(window, { key: 'Alt', code: 'AltLeft', altKey: false });

    await waitFor(() => {
      expect(mockReadSelectionText).toHaveBeenCalledTimes(1);
      expect(mockShowOcrResultWindow).toHaveBeenCalledTimes(1);
    });
    expect(mockShowOcrResultWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        initialText: 'selected text',
        autoTranslate: true,
      }),
    );
  });

  it('shows cached result when selection is missing and keep-result is enabled', async () => {
    mockReadSelectionText.mockRejectedValue({
      code: 'no_selection',
      message: '未检测到选中文本',
      retryable: false,
    });
    window.localStorage.setItem(
      'lingoflow.ocr_result.workspace.v2',
      JSON.stringify({
        autoTranslate: false,
        initialText: 'cached text',
        mode: 'input_translate',
        sourceLanguageCode: 'en',
        sourceLanguageLabel: '英语',
        targetLanguageCode: 'zh-CN',
        targetLanguageLabel: '简体中文',
      }),
    );

    render(<App />);

    fireEvent.keyDown(window, { key: 'd', code: 'KeyD', altKey: true });
    fireEvent.keyUp(window, { key: 'd', code: 'KeyD', altKey: true });
    fireEvent.keyUp(window, { key: 'Alt', code: 'AltLeft', altKey: false });

    await waitFor(() => {
      expect(mockShowCachedOcrResultWindow).toHaveBeenCalledTimes(1);
    });
    expect(mockShowOcrResultWindow).not.toHaveBeenCalled();
  });

  it('hides the window for the hide-interface shortcut in web fallback', async () => {
    render(<App />);

    fireEvent.keyDown(window, { key: 'q', code: 'KeyQ', altKey: true });
    fireEvent.keyUp(window, { key: 'q', code: 'KeyQ', altKey: true });
    expect(mockMainWindowHide).not.toHaveBeenCalled();

    fireEvent.keyUp(window, { key: 'Alt', code: 'AltLeft', altKey: false });
    await waitFor(() => {
      expect(mockMainWindowHide).toHaveBeenCalledTimes(1);
      expect(mockMainWindowShow).not.toHaveBeenCalled();
      expect(mockMainWindowUnminimize).not.toHaveBeenCalled();
      expect(mockMainWindowSetFocus).not.toHaveBeenCalled();
    });
  });

  it('triggers open-settings shortcut after modifiers are released', async () => {
    render(<App />);

    fireEvent.keyDown(window, { key: ',', code: 'Comma', ctrlKey: true });
    fireEvent.keyUp(window, { key: ',', code: 'Comma', ctrlKey: true });
    expect(mockMainWindowShow).not.toHaveBeenCalled();

    fireEvent.keyUp(window, { key: 'Control', code: 'ControlLeft', ctrlKey: false });
    await waitFor(() => {
      expect(mockMainWindowShow).toHaveBeenCalledTimes(1);
      expect(mockMainWindowUnminimize).toHaveBeenCalledTimes(1);
      expect(mockMainWindowSetFocus).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps window keyboard shortcuts active in tauri runtime', () => {
    (window as Window & { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {};

    render(<App />);

    fireEvent.keyDown(window, { key: 's', code: 'KeyS', altKey: true });
    fireEvent.keyUp(window, { key: 's', code: 'KeyS', altKey: true });
    fireEvent.keyUp(window, { key: 'Alt', code: 'AltLeft', altKey: false });

    expect(mockShowOcrResultWindow).not.toHaveBeenCalled();
    expect(mockSyncNativeShortcuts).toHaveBeenCalledTimes(1);
    expect(mockSyncRuntimeSettings).toHaveBeenCalledTimes(1);
  });

  it('syncs shortcuts to rust instead of registering them in the window runtime', () => {
    (window as Window & { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {};

    render(<App />);

    expect(mockSyncNativeShortcuts).toHaveBeenCalledTimes(1);
    expect(mockSyncRuntimeSettings).toHaveBeenCalledTimes(1);
  });

  it('never installs js global shortcut registration in tauri runtime', () => {
    (window as Window & { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {};

    render(<App />);

    expect(mockSyncNativeShortcuts).toHaveBeenCalledTimes(1);
    expect(mockSyncRuntimeSettings).toHaveBeenCalledTimes(1);
  });

  it('does not focus settings window for show-main-window tray action in tauri runtime', async () => {
    (window as Window & { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {};

    render(<App />);

    await waitFor(() => {
      expect(mockListen).toHaveBeenCalledTimes(1);
      expect(mockTrayListeners[0]).toBeTypeOf('function');
    });

    const trayListener = mockTrayListeners[0];
    trayListener?.({ payload: { action: 'show_main_window' } });

    await waitFor(() => {
      expect(mockMainWindowShow).not.toHaveBeenCalled();
      expect(mockMainWindowUnminimize).not.toHaveBeenCalled();
      expect(mockMainWindowSetFocus).not.toHaveBeenCalled();
    });
  });

  it('uses latest target language for windows screenshot translate tray action', async () => {
    const originalUserAgent = navigator.userAgent;
    window.localStorage.setItem(
      'lingoflow.settings.v1',
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        primaryLanguage: 'en',
        detectionMode: 'auto',
      }),
    );
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });

    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: '通用' }));
    fireEvent.change(screen.getByLabelText('第二语言'), {
      target: { value: 'ja' },
    });

    await waitFor(() => {
      expect(mockListen.mock.calls.length).toBeGreaterThan(0);
      expect(mockTrayListeners.at(-1)).toBeTypeOf('function');
    });

    const trayListener = mockTrayListeners.at(-1);
    trayListener?.({ payload: { action: 'ocr_translate' } });

    await waitFor(() => {
      expect(mockShowScreenshotOverlay).toHaveBeenCalledTimes(1);
    });
    expect(mockShowScreenshotOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLangHint: 'auto',
        targetLang: 'ja',
        targetLanguageCode: 'ja',
        targetLanguageLabel: '日语',
      }),
    );

    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
  });
});
