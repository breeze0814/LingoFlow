import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { MainLayout } from './layout/MainLayout';
import { PermissionStatus } from '../features/settings/permissionStatus';
import { loadPermissionStatusFromNative } from '../features/settings/permissionStatusStorage';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import { initialTaskState } from '../features/task/taskReducer';
import { DEFAULT_SETTINGS, SettingsState } from '../features/settings/settingsTypes';
import {
  loadSettingsFromStorage,
  redactSensitiveSettings,
  saveSettingsToStorage,
} from '../features/settings/settingsStorage';
import { isTrayActionPayload, TRAY_ACTION_EVENT } from '../features/tray/trayEvents';
import { matchesShortcut } from '../features/settings/shortcutMatcher';
import { primeOcrResultWindowService } from '../features/ocr/ocrResultWindowService';
import { syncNativeShortcuts } from '../features/settings/nativeShortcutSyncService';
import { syncRuntimeSettings } from '../features/settings/runtimeSettingsSyncService';
import { primeScreenshotOverlayService } from '../features/screenshot/screenshotOverlayService';
import {
  loadSettingsFromNativeStorage,
  saveSettingsToNativeStorage,
} from '../features/settings/nativeSettingsStorage';
import {
  OPEN_INPUT_TRANSLATE_EVENT,
  isOpenInputTranslatePayload,
} from '../features/translator/inputTranslateEvents';
import {
  hasActiveModifiers,
  isShortcutRecording,
  isTauriRuntime,
  isWindowsTauriRuntime,
  ShortcutAction,
  shouldSkipKeybindingTarget,
} from './appRuntime';
import { useAppActions } from './useAppActions';
import { ErrorBoundary } from '../infra/ErrorBoundary';

const NATIVE_SETTINGS_SAVE_DEBOUNCE_MS = 300;
type NativeSettingsHydrationState = 'pending' | 'ready' | 'failed';

export function App() {
  const tauriRuntime = isTauriRuntime();
  const [taskState, updateTaskState] = useState(initialTaskState);
  const [settings, setSettings] = useState<SettingsState>(() =>
    tauriRuntime ? DEFAULT_SETTINGS : loadSettingsFromStorage(),
  );
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const [nativeSettingsHydrationState, setNativeSettingsHydrationState] =
    useState<NativeSettingsHydrationState>(() => (tauriRuntime ? 'pending' : 'ready'));
  const pendingShortcutActionRef = useRef<ShortcutAction | null>(null);
  const { executeShortcutAction, handleTrayAction, openInputTranslateWorkspace } = useAppActions({
    settings,
    taskState,
    setTaskState: updateTaskState,
  });
  const trayActionHandlerRef = useRef(handleTrayAction);
  const inputTranslateHandlerRef = useRef(openInputTranslateWorkspace);
  const shortcutExecutorRef = useRef(executeShortcutAction);
  const shortcutConfigRef = useRef(settings.shortcuts);
  const nativeSettingsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativeSettingsReady = nativeSettingsHydrationState === 'ready';

  useEffect(() => {
    trayActionHandlerRef.current = handleTrayAction;
  }, [handleTrayAction]);

  useEffect(() => {
    shortcutExecutorRef.current = executeShortcutAction;
  }, [executeShortcutAction]);

  useEffect(() => {
    inputTranslateHandlerRef.current = openInputTranslateWorkspace;
  }, [openInputTranslateWorkspace]);

  useEffect(() => {
    shortcutConfigRef.current = settings.shortcuts;
  }, [settings.shortcuts]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let cleanup: null | (() => void) = null;
    let inputCleanup: null | (() => void) = null;
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

    async function bindInputTranslateListener() {
      try {
        const unlisten = await listen(OPEN_INPUT_TRANSLATE_EVENT, (event) => {
          if (!isOpenInputTranslatePayload(event.payload)) {
            return;
          }
          void inputTranslateHandlerRef.current(event.payload);
        });
        if (disposed) {
          unlisten();
          return;
        }
        inputCleanup = unlisten;
      } catch (error) {
        console.warn('input translate listener binding failed', error);
      }
    }

    void bindTrayActionListener();
    void bindInputTranslateListener();
    return () => {
      disposed = true;
      if (cleanup) {
        cleanup();
      }
      if (inputCleanup) {
        inputCleanup();
      }
    };
  }, []);

  useEffect(() => {
    if (!tauriRuntime) {
      return;
    }

    let disposed = false;

    async function hydrateNativeSettings() {
      try {
        const loadedSettings = await loadSettingsFromNativeStorage();
        if (!disposed && loadedSettings) {
          setSettings(loadedSettings);
        }
        if (!disposed) {
          setNativeSettingsHydrationState('ready');
        }
      } catch (error) {
        console.error('native settings load failed', error);
        if (!disposed) {
          setNativeSettingsHydrationState('failed');
        }
      }
    }

    void hydrateNativeSettings();
    return () => {
      disposed = true;
    };
  }, [tauriRuntime]);

  useEffect(() => {
    if (!tauriRuntime) {
      return;
    }

    let disposed = false;

    async function hydratePermissionStatus() {
      try {
        const nextStatus = await loadPermissionStatusFromNative();
        if (!disposed) {
          setPermissionStatus(nextStatus);
        }
      } catch (error) {
        console.error('permission status load failed', error);
      }
    }

    void hydratePermissionStatus();
    return () => {
      disposed = true;
    };
  }, [tauriRuntime]);

  useEffect(() => {
    if (!tauriRuntime || !nativeSettingsReady) {
      return;
    }

    void syncNativeShortcuts(settings.shortcuts).catch((error) => {
      console.error('native shortcut sync failed', error);
    });
  }, [settings.shortcuts, nativeSettingsReady, tauriRuntime]);

  useEffect(() => {
    if (!tauriRuntime || !nativeSettingsReady) {
      return;
    }

    void syncRuntimeSettings({
      httpApiEnabled: settings.httpApiEnabled,
      httpApiPort: settings.httpApiPort,
      sourceLang: settings.primaryLanguage,
      targetLang: settings.secondaryLanguage,
    }).catch((error) => {
      console.error('runtime settings sync failed', error);
    });
  }, [
    settings.httpApiEnabled,
    settings.httpApiPort,
    settings.primaryLanguage,
    settings.secondaryLanguage,
    nativeSettingsReady,
    tauriRuntime,
  ]);

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
    if (tauriRuntime && !nativeSettingsReady) {
      return;
    }
    const cachedSettings = tauriRuntime ? redactSensitiveSettings(settings) : settings;
    saveSettingsToStorage(cachedSettings);
    if (!tauriRuntime) {
      return;
    }
    if (nativeSettingsSaveTimerRef.current) {
      clearTimeout(nativeSettingsSaveTimerRef.current);
    }
    const snapshot = settings;
    nativeSettingsSaveTimerRef.current = setTimeout(() => {
      nativeSettingsSaveTimerRef.current = null;
      void saveSettingsToNativeStorage(snapshot).catch((error) => {
        console.error('native settings save failed', error);
      });
    }, NATIVE_SETTINGS_SAVE_DEBOUNCE_MS);
    return () => {
      if (!nativeSettingsSaveTimerRef.current) {
        return;
      }
      clearTimeout(nativeSettingsSaveTimerRef.current);
      nativeSettingsSaveTimerRef.current = null;
    };
  }, [settings, nativeSettingsReady, tauriRuntime]);

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
    <ErrorBoundary>
      <MainLayout>
        <section className="workspace">
          <section className="settingsHome">
            <SettingsPanel
              value={settings}
              onChange={setSettings}
              permissionStatus={permissionStatus}
              onRefreshPermissions={
                tauriRuntime
                  ? () => {
                      void loadPermissionStatusFromNative()
                        .then((nextStatus) => setPermissionStatus(nextStatus))
                        .catch((error) => {
                          console.error('permission status refresh failed', error);
                        });
                    }
                  : undefined
              }
            />
          </section>
        </section>
      </MainLayout>
    </ErrorBoundary>
  );
}
