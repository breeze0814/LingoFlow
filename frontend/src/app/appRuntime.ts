import { LANGUAGE_OPTIONS } from '../features/settings/settingsTypes';

export type ShortcutAction =
  | 'input_translate'
  | 'selection_translate'
  | 'ocr_translate'
  | 'ocr_recognize'
  | 'hide_interface'
  | 'show_main_window'
  | 'open_settings';

export function languageLabel(code: string): string {
  const found = LANGUAGE_OPTIONS.find((item) => item.value === code);
  return found ? found.label : code;
}

export function shouldSkipKeybindingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  return target.isContentEditable;
}

export function isShortcutRecording(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return document.querySelector('[data-shortcut-recording="true"]') !== null;
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function isWindowsTauriRuntime(): boolean {
  if (!isTauriRuntime() || typeof navigator === 'undefined') {
    return false;
  }
  return navigator.userAgent.includes('Windows');
}

export function hasActiveModifiers(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
}
