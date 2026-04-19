import { commandsClient } from '../../infra/tauri/commands';
import { PermissionStatus, isPermissionStatus } from './permissionStatus';
import { isTauriRuntime } from '../../app/appRuntime';

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
