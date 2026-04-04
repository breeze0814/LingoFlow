import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

import { syncNativeShortcuts } from '../../features/settings/nativeShortcutSyncService';
import { DEFAULT_SHORTCUTS } from '../../features/settings/settingsTypes';

describe('nativeShortcutSyncService', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('syncs the current shortcut config to rust', async () => {
    await syncNativeShortcuts(DEFAULT_SHORTCUTS);

    expect(mockInvoke).toHaveBeenCalledWith('sync_global_shortcuts', {
      shortcuts: DEFAULT_SHORTCUTS,
    });
  });
});
