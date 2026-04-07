import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { type ShortcutConfig } from '../features/settings/settingsTypes';
import { syncNativeShortcuts } from '../features/settings/nativeShortcutSyncService';
import { syncRuntimeSettings } from '../features/settings/runtimeSettingsSyncService';
import { primeOcrResultWindowService } from '../features/ocr/ocrResultWindowService';
import { primeScreenshotOverlayService } from '../features/screenshot/screenshotOverlayService';
import {
  isTrayActionPayload,
  TRAY_ACTION_EVENT,
  type TrayAction,
} from '../features/tray/trayEvents';
import { isTauriRuntime, isWindowsTauriRuntime } from './appRuntime';

type UseTauriBindingsInput = {
  handleTrayAction: (action: TrayAction) => Promise<void>;
  httpApiEnabled: boolean;
  shortcuts: ShortcutConfig;
};

export function useTauriBindings(input: UseTauriBindingsInput) {
  useTrayActionListener(input.handleTrayAction);
  useNativeShortcutSync(input.shortcuts);
  useRuntimeSettingsSync(input.httpApiEnabled);
  useWindowsServicePriming();
}

function useTrayActionListener(handleTrayAction: UseTauriBindingsInput['handleTrayAction']) {
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
          void handleTrayAction(event.payload.action);
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
      cleanup?.();
    };
  }, [handleTrayAction]);
}

function useNativeShortcutSync(shortcuts: ShortcutConfig) {
  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    void syncNativeShortcuts(shortcuts).catch((error) => {
      console.error('native shortcut sync failed', error);
    });
  }, [shortcuts]);
}

function useRuntimeSettingsSync(httpApiEnabled: boolean) {
  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    void syncRuntimeSettings({ httpApiEnabled }).catch((error) => {
      console.error('runtime settings sync failed', error);
    });
  }, [httpApiEnabled]);
}

function useWindowsServicePriming() {
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
}
