import { commandsClient } from '../../infra/tauri/commands';
import { SettingsState } from './settingsTypes';
import { loadSettingsFromStorage, parseStoredSettings } from './settingsStorage';
import { isTauriRuntime } from '../../app/appRuntime';

export async function loadSettingsFromNativeStorage(): Promise<SettingsState | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  const payload = await commandsClient.loadSettings();
  return payload ? parseStoredSettings(payload) : null;
}

export async function saveSettingsToNativeStorage(settings: SettingsState): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await commandsClient.saveSettings(settings);
}

export async function loadSettingsForTranslation(): Promise<SettingsState> {
  return (await loadSettingsFromNativeStorage()) ?? loadSettingsFromStorage();
}
