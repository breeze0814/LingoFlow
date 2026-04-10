import { commandsClient } from '../../infra/tauri/commands';
import { PermissionStatus, isPermissionStatus } from './permissionStatus';

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function loadPermissionStatusFromNative(): Promise<PermissionStatus | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  const payload = await commandsClient.getPermissionStatus();
  if (!isPermissionStatus(payload)) {
    throw new Error('invalid permission status payload');
  }
  return payload;
}
