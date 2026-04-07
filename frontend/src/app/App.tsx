import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { MainLayout } from './layout/MainLayout';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import { initialTaskState } from '../features/task/taskReducer';
import { SettingsState } from '../features/settings/settingsTypes';
import {
  loadSettingsFromStorage,
  saveSettingsToStorage,
} from '../features/settings/settingsStorage';
import { isTrayActionPayload, TRAY_ACTION_EVENT } from '../features/tray/trayEvents';
import { matchesShortcut } from '../features/settings/shortcutMatcher';
import { primeOcrResultWindowService } from '../features/ocr/ocrResultWindowService';
import { syncNativeShortcuts } from '../features/settings/nativeShortcutSyncService';
import { syncRuntimeSettings } from '../features/settings/runtimeSettingsSyncService';
import { primeScreenshotOverlayService } from '../features/screenshot/screenshotOverlayService';
import {
  hasActiveModifiers,
  isShortcutRecording,
  isTauriRuntime,
  isWindowsTauriRuntime,
  ShortcutAction,
  shouldSkipKeybindingTarget,
} from './appRuntime';
import { useAppActions } from './useAppActions';

export function App() {
  const [taskState, updateTaskState] = useState(initialTaskState);
  const [settings, setSettings] = useState<SettingsState>(() => loadSettingsFromStorage());
  const pendingShortcutActionRef = useRef<ShortcutAction | null>(null);
  const { executeShortcutAction, handleTrayAction } = useAppActions({
    settings,
    taskState,
    setTaskState: updateTaskState,
  });
  const trayActionHandlerRef = useRef(handleTrayAction);
  const shortcutExecutorRef = useRef(executeShortcutAction);
  const shortcutConfigRef = useRef(settings.shortcuts);

  useEffect(() => {
    trayActionHandlerRef.current = handleTrayAction;
  }, [handleTrayAction]);

  useEffect(() => {
    shortcutExecutorRef.current = executeShortcutAction;
  }, [executeShortcutAction]);

  useEffect(() => {
    shortcutConfigRef.current = settings.shortcuts;
  }, [settings.shortcuts]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let cleanup: null | (() => void) = null;
    let disposed = false;

    async function bindTrayActionListener() {
      try {
        const unlisten = await listen(TRAY_ACTION_EVENT, (event) => {
          if (!isTrayActionPayload(event.payload)) {
            return;
          }
          void trayActionHandlerRef.current(event.payload.action);
        });
        if (disposed) {
          unlisten();
          return;
        }
        cleanup = unlisten;
      } catch (error) {
        console.warn('tray action listener binding failed', error);
      }
    }

    void bindTrayActionListener();
    return () => {
      disposed = true;
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    void syncNativeShortcuts(settings.shortcuts).catch((error) => {
      console.error('native shortcut sync failed', error);
    });
  }, [settings.shortcuts]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    void syncRuntimeSettings({
      httpApiEnabled: settings.httpApiEnabled,
    }).catch((error) => {
      console.error('runtime settings sync failed', error);
    });
  }, [settings.httpApiEnabled]);

  useEffect(() => {
    if (!isWindowsTauriRuntime()) {
      return;
    }

    void primeScreenshotOverlayService().catch((error) => {
      console.error('screenshot overlay service init failed', error);
    });
    void primeOcrResultWindowService().catch((error) => {
      console.error('ocr result window service init failed', error);
    });
  }, []);

  useEffect(() => {
    saveSettingsToStorage(settings);
  }, [settings]);

  useEffect(() => {
    if (isTauriRuntime()) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const shortcuts = shortcutConfigRef.current;
      if (isShortcutRecording()) {
        return;
      }
      if (shouldSkipKeybindingTarget(event.target)) {
        return;
      }

      if (matchesShortcut(event, shortcuts.inputTranslate)) {
        event.preventDefault();
        pendingShortcutActionRef.current = 'input_translate';
        return;
      }
      if (matchesShortcut(event, shortcuts.ocrTranslate)) {
        event.preventDefault();
        pendingShortcutActionRef.current = 'ocr_translate';
        return;
      }
      if (matchesShortcut(event, shortcuts.hideInterface)) {
        event.preventDefault();
        pendingShortcutActionRef.current = 'hide_interface';
        return;
      }
      if (matchesShortcut(event, shortcuts.selectionTranslate)) {
        event.preventDefault();
        pendingShortcutActionRef.current = 'selection_translate';
        return;
      }
      if (matchesShortcut(event, shortcuts.ocrRecognize)) {
        event.preventDefault();
        pendingShortcutActionRef.current = 'ocr_recognize';
        return;
      }
      if (matchesShortcut(event, shortcuts.openSettings)) {
        event.preventDefault();
        pendingShortcutActionRef.current = 'open_settings';
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const pendingAction = pendingShortcutActionRef.current;
      if (!pendingAction) {
        return;
      }
      if (hasActiveModifiers(event)) {
        return;
      }
      pendingShortcutActionRef.current = null;
      shortcutExecutorRef.current(pendingAction);
    };

    const onWindowBlur = () => {
      pendingShortcutActionRef.current = null;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, []);

  return (
    <MainLayout>
      <section className="workspace">
        <section className="settingsHome">
          <SettingsPanel value={settings} onChange={setSettings} />
        </section>
      </section>
    </MainLayout>
  );
}
