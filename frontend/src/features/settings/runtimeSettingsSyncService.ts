import { commandsClient } from '../../infra/tauri/commands';

type RuntimeSettingsSyncInput = {
  httpApiEnabled: boolean;
  sourceLang: string;
  targetLang: string;
};

export async function syncRuntimeSettings(settings: RuntimeSettingsSyncInput): Promise<void> {
  await commandsClient.syncRuntimeSettings(settings);
}
