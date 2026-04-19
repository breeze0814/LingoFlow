import { renderHook, waitFor } from '@testing-library/react';
import { useAppActions } from '../../app/useAppActions';
import { DEFAULT_SETTINGS, SettingsState } from '../../features/settings/settingsTypes';
import { initialTaskState } from '../../features/task/taskReducer';
import { TaskState } from '../../features/task/taskTypes';

const {
  mockShowOcrResultWindow,
  mockShowCachedOcrResultWindow,
  mockShowScreenshotOverlay,
  mockTriggerOcrRecognize,
  mockReadSelectionText,
  mockMainWindowShow,
  mockMainWindowHide,
  mockMainWindowUnminimize,
  mockMainWindowSetFocus,
  mockGetCurrentWindow,
} = vi.hoisted(() => ({
  mockShowOcrResultWindow: vi.fn().mockResolvedValue(undefined),
  mockShowCachedOcrResultWindow: vi.fn().mockResolvedValue(undefined),
  mockShowScreenshotOverlay: vi.fn().mockResolvedValue(undefined),
  mockTriggerOcrRecognize: vi.fn(),
  mockReadSelectionText: vi.fn(),
  mockMainWindowShow: vi.fn().mockResolvedValue(undefined),
  mockMainWindowHide: vi.fn().mockResolvedValue(undefined),
  mockMainWindowUnminimize: vi.fn().mockResolvedValue(undefined),
  mockMainWindowSetFocus: vi.fn().mockResolvedValue(undefined),
  mockGetCurrentWindow: vi.fn(),
}));

vi.mock('../../features/ocr/ocrResultWindowService', () => ({
  showOcrResultWindow: mockShowOcrResultWindow,
  showCachedOcrResultWindow: mockShowCachedOcrResultWindow,
}));

vi.mock('../../features/screenshot/screenshotOverlayService', () => ({
  showScreenshotOverlay: mockShowScreenshotOverlay,
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

vi.mock('../../infra/tauri/commands', () => ({
  commandsClient: {
    readSelectionText: mockReadSelectionText,
  },
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: mockGetCurrentWindow,
}));

describe('useAppActions', () => {
  let mockSetTaskState: ReturnType<typeof vi.fn>;
  let testSettings: SettingsState;
  let testTaskState: TaskState;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetTaskState = vi.fn();
    testSettings = { ...DEFAULT_SETTINGS };
    testTaskState = { ...initialTaskState };

    mockGetCurrentWindow.mockReturnValue({
      show: mockMainWindowShow,
      hide: mockMainWindowHide,
      unminimize: mockMainWindowUnminimize,
      setFocus: mockMainWindowSetFocus,
    });
  });

  describe('openInputTranslateWorkspace', () => {
    it('opens input translate workspace with default languages', async () => {
      const { result } = renderHook(() =>
        useAppActions({
          settings: testSettings,
          taskState: testTaskState,
          setTaskState: mockSetTaskState,
        }),
      );

      await result.current.openInputTranslateWorkspace();

      expect(mockShowOcrResultWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'input_translate',
          sourceLanguageCode: testSettings.primaryLanguage,
          targetLanguageCode: testSettings.secondaryLanguage,
          initialText: '',
        }),
      );
    });

    it('opens input translate workspace with custom request', async () => {
      const { result } = renderHook(() =>
        useAppActions({
          settings: testSettings,
          taskState: testTaskState,
          setTaskState: mockSetTaskState,
        }),
      );

      await result.current.openInputTranslateWorkspace({
        sourceLang: 'en',
        targetLang: 'ja',
        text: 'Hello',
      });

      expect(mockShowOcrResultWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'input_translate',
          sourceLanguageCode: 'en',
          targetLanguageCode: 'ja',
          initialText: 'Hello',
        }),
      );
    });

    it('handles window open error gracefully', async () => {
      mockShowOcrResultWindow.mockRejectedValueOnce(new Error('Window open failed'));

      const { result } = renderHook(() =>
        useAppActions({
          settings: testSettings,
          taskState: testTaskState,
          setTaskState: mockSetTaskState,
        }),
      );

      await result.current.openInputTranslateWorkspace();

      await waitFor(() => {
        expect(mockSetTaskState).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'failure',
            error: expect.objectContaining({
              code: 'ui_error',
              message: expect.stringContaining('Window open failed'),
            }),
          }),
        );
      });
    });
  });

  describe('executeShortcutAction', () => {
    it('executes input_translate action', async () => {
      const { result } = renderHook(() =>
        useAppActions({
          settings: testSettings,
          taskState: testTaskState,
          setTaskState: mockSetTaskState,
        }),
      );

      result.current.executeShortcutAction('input_translate');

      await waitFor(() => {
        expect(mockShowOcrResultWindow).toHaveBeenCalled();
      });
    });

    it('executes hide_interface action', async () => {
      const { result } = renderHook(() =>
        useAppActions({
          settings: testSettings,
          taskState: testTaskState,
          setTaskState: mockSetTaskState,
        }),
      );

      result.current.executeShortcutAction('hide_interface');

      await waitFor(() => {
        expect(mockMainWindowHide).toHaveBeenCalled();
      });
    });

    it('executes open_settings action', async () => {
      const { result } = renderHook(() =>
        useAppActions({
          settings: testSettings,
          taskState: testTaskState,
          setTaskState: mockSetTaskState,
        }),
      );

      result.current.executeShortcutAction('open_settings');

      await waitFor(() => {
        expect(mockMainWindowShow).toHaveBeenCalled();
        expect(mockMainWindowUnminimize).toHaveBeenCalled();
        expect(mockMainWindowSetFocus).toHaveBeenCalled();
      });
    });

    it('handles show_main_window action (no-op)', () => {
      const { result } = renderHook(() =>
        useAppActions({
          settings: testSettings,
          taskState: testTaskState,
          setTaskState: mockSetTaskState,
        }),
      );

      result.current.executeShortcutAction('show_main_window');

      expect(mockShowOcrResultWindow).not.toHaveBeenCalled();
    });
  });

  describe('handleTrayAction', () => {
    it('handles input_translate tray action', async () => {
      const { result } = renderHook(() =>
        useAppActions({
          settings: testSettings,
          taskState: testTaskState,
          setTaskState: mockSetTaskState,
        }),
      );

      await result.current.handleTrayAction('input_translate');

      expect(mockShowOcrResultWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'input_translate',
        }),
      );
    });

    it('handles open_settings tray action', async () => {
      const { result } = renderHook(() =>
        useAppActions({
          settings: testSettings,
          taskState: testTaskState,
          setTaskState: mockSetTaskState,
        }),
      );

      await result.current.handleTrayAction('open_settings');

      expect(mockMainWindowShow).toHaveBeenCalled();
      expect(mockMainWindowUnminimize).toHaveBeenCalled();
      expect(mockMainWindowSetFocus).toHaveBeenCalled();
    });

    it('handles show_main_window tray action (no-op)', async () => {
      const { result } = renderHook(() =>
        useAppActions({
          settings: testSettings,
          taskState: testTaskState,
          setTaskState: mockSetTaskState,
        }),
      );

      await result.current.handleTrayAction('show_main_window');

      expect(mockShowOcrResultWindow).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('handles window focus error gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mockMainWindowShow.mockRejectedValueOnce(new Error('Focus failed'));

      const { result } = renderHook(() =>
        useAppActions({
          settings: testSettings,
          taskState: testTaskState,
          setTaskState: mockSetTaskState,
        }),
      );

      await result.current.handleTrayAction('open_settings');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'failed to focus settings window',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it('handles window hide error gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mockMainWindowHide.mockRejectedValueOnce(new Error('Hide failed'));

      const { result } = renderHook(() =>
        useAppActions({
          settings: testSettings,
          taskState: testTaskState,
          setTaskState: mockSetTaskState,
        }),
      );

      result.current.executeShortcutAction('hide_interface');

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'failed to hide current window',
          expect.any(Error),
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });
});
