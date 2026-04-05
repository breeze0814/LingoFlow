import { invoke } from '@tauri-apps/api/core';

let excluded = false;

export async function ensureCaptureExcluded(): Promise<void> {
  if (excluded) {
    return;
  }
  try {
    await invoke('set_capture_excluded');
    excluded = true;
  } catch (error) {
    console.warn('Failed to set capture exclusion (requires Windows 10 2004+):', error);
  }
}
