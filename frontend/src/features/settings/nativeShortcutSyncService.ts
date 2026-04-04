import { invoke } from '@tauri-apps/api/core';
import { ShortcutConfig } from './settingsTypes';

const SYNC_GLOBAL_SHORTCUTS_COMMAND = 'sync_global_shortcuts';

export async function syncNativeShortcuts(shortcuts: ShortcutConfig): Promise<void> {
  await invoke(SYNC_GLOBAL_SHORTCUTS_COMMAND, { shortcuts });
}
