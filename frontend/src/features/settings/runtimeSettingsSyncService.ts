import { commandsClient } from '../../infra/tauri/commands';

type RuntimeSettingsSyncInput = {
  httpApiEnabled: boolean;
  httpApiPort: number;
  sourceLang: string;
  targetLang: string;
};

let runtimeSettingsSyncQueue: Promise<void> = Promise.resolve();

export async function syncRuntimeSettings(settings: RuntimeSettingsSyncInput): Promise<void> {
  runtimeSettingsSyncQueue = runtimeSettingsSyncQueue
    .catch(() => undefined)
    .then(async () => {
      await commandsClient.syncRuntimeSettings(settings);
    });
  await runtimeSettingsSyncQueue;
}
