export const TRAY_ACTION_EVENT = 'tray://action';

export const SUPPORTED_TRAY_ACTIONS = [
  'input_translate',
  'selection_translate',
  'ocr_translate',
  'ocr_recognize',
  'open_settings',
  'show_main_window',
  'check_update',
] as const;

export type TrayAction = (typeof SUPPORTED_TRAY_ACTIONS)[number];

export type TrayActionPayload = {
  action: TrayAction;
};

const trayActionSet = new Set<string>(SUPPORTED_TRAY_ACTIONS);

export function isTrayActionPayload(value: unknown): value is TrayActionPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const maybePayload = value as { action?: unknown };
  return typeof maybePayload.action === 'string' && trayActionSet.has(maybePayload.action);
}
