import { describe, expect, it, vi } from 'vitest';

const { mockSyncRuntimeSettings } = vi.hoisted(() => ({
  mockSyncRuntimeSettings: vi.fn(),
}));

vi.mock('../../infra/tauri/commands', () => ({
  commandsClient: {
    syncRuntimeSettings: mockSyncRuntimeSettings,
  },
}));

import { syncRuntimeSettings } from '../../features/settings/runtimeSettingsSyncService';

describe('runtimeSettingsSyncService', () => {
  it('serializes runtime sync calls to avoid out-of-order updates', async () => {
    let resolveFirstCall!: () => void;
    mockSyncRuntimeSettings
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirstCall = () => {
              resolve();
            };
          }),
      )
      .mockResolvedValueOnce(undefined);

    const firstPayload = {
      httpApiEnabled: true,
      httpApiPort: 61928,
      sourceLang: 'en',
      targetLang: 'zh-CN',
    };
    const secondPayload = {
      httpApiEnabled: false,
      httpApiPort: 61929,
      sourceLang: 'ja',
      targetLang: 'en',
    };

    const firstPromise = syncRuntimeSettings(firstPayload);
    const secondPromise = syncRuntimeSettings(secondPayload);

    await vi.waitFor(() => {
      expect(mockSyncRuntimeSettings).toHaveBeenCalledTimes(1);
      expect(mockSyncRuntimeSettings).toHaveBeenNthCalledWith(1, firstPayload);
    });

    resolveFirstCall();
    await firstPromise;
    await secondPromise;

    expect(mockSyncRuntimeSettings).toHaveBeenCalledTimes(2);
    expect(mockSyncRuntimeSettings).toHaveBeenNthCalledWith(2, secondPayload);
  });
});
