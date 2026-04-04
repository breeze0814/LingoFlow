import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../app/App';

const {
  mockShowOcrResultWindow,
  mockShowCachedOcrResultWindow,
  mockMainWindowShow,
  mockMainWindowHide,
  mockMainWindowUnminimize,
  mockMainWindowSetFocus,
  mockSyncNativeShortcuts,
  mockTrayListeners,
  mockListen,
} = vi.hoisted(() => ({
  mockShowOcrResultWindow: vi.fn().mockResolvedValue(undefined),
  mockShowCachedOcrResultWindow: vi.fn().mockResolvedValue(undefined),
  mockMainWindowShow: vi.fn().mockResolvedValue(undefined),
  mockMainWindowHide: vi.fn().mockResolvedValue(undefined),
  mockMainWindowUnminimize: vi.fn().mockResolvedValue(undefined),
  mockMainWindowSetFocus: vi.fn().mockResolvedValue(undefined),
  mockSyncNativeShortcuts: vi.fn().mockResolvedValue(undefined),
  mockTrayListeners: [] as Array<(event: { payload: unknown }) => void>,
  mockListen: vi.fn().mockImplementation(async (_eventName, handler) => {
    mockTrayListeners.push(handler as (event: { payload: unknown }) => void);
    return () => undefined;
  }),
}));

vi.mock('../../features/ocr/ocrResultWindowService', () => ({
  showOcrResultWindow: mockShowOcrResultWindow,
  showCachedOcrResultWindow: mockShowCachedOcrResultWindow,
}));

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

describe('App', () => {
  beforeEach(() => {
    mockShowOcrResultWindow.mockClear();
    mockShowCachedOcrResultWindow.mockClear();
    mockMainWindowShow.mockClear();
    mockMainWindowHide.mockClear();
    mockMainWindowUnminimize.mockClear();
    mockMainWindowSetFocus.mockClear();
    mockSyncNativeShortcuts.mockClear();
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
  });

  it('syncs shortcuts to rust instead of registering them in the window runtime', () => {
    (window as Window & { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {};

    render(<App />);

    expect(mockSyncNativeShortcuts).toHaveBeenCalledTimes(1);
  });

  it('never installs js global shortcut registration in tauri runtime', () => {
    (window as Window & { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {};

    render(<App />);

    expect(mockSyncNativeShortcuts).toHaveBeenCalledTimes(1);
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
});
