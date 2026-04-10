import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPermissionStatusFromNative } from '../../features/settings/permissionStatusStorage';

const { mockGetPermissionStatus } = vi.hoisted(() => ({
  mockGetPermissionStatus: vi.fn(),
}));

vi.mock('../../infra/tauri/commands', () => ({
  commandsClient: {
    getPermissionStatus: mockGetPermissionStatus,
  },
}));

describe('permissionStatusStorage', () => {
  beforeEach(() => {
    mockGetPermissionStatus.mockReset();
    delete (window as typeof window & { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__;
  });

  it('returns null outside tauri runtime', async () => {
    await expect(loadPermissionStatusFromNative()).resolves.toBeNull();
    expect(mockGetPermissionStatus).not.toHaveBeenCalled();
  });

  it('accepts camelCase permission payload from native bridge', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
    mockGetPermissionStatus.mockResolvedValue({
      accessibility: 'granted',
      screenRecording: 'denied',
    });

    await expect(loadPermissionStatusFromNative()).resolves.toEqual({
      accessibility: 'granted',
      screenRecording: 'denied',
    });
  });

  it('rejects invalid permission payloads', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
    mockGetPermissionStatus.mockResolvedValue({
      accessibility: 'granted',
      screen_recording: 'denied',
    });

    await expect(loadPermissionStatusFromNative()).rejects.toThrow(
      'invalid permission status payload',
    );
  });
});
