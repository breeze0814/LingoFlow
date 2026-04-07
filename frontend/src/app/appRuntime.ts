import { LANGUAGE_OPTIONS, type SettingsState } from '../features/settings/settingsTypes';
import { resolveConfiguredSourceLanguage } from '../features/settings/settingsRuntime';
import { type TaskState, type TaskType } from '../features/task/taskTypes';

export type ShortcutAction =
  | 'input_translate'
  | 'selection_translate'
  | 'ocr_translate'
  | 'ocr_recognize'
  | 'hide_interface'
  | 'show_main_window'
  | 'open_settings';

export function makeTaskId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `task_${Date.now()}`;
}

export function makeUiError(taskType: TaskType, message: string): TaskState {
  return {
    taskId: makeTaskId(),
    taskType,
    status: 'failure',
    result: null,
    error: {
      code: 'ui_error',
      message,
      retryable: true,
    },
  };
}

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

export function resolveSourceLanguageHint(settings: SettingsState) {
  return resolveConfiguredSourceLanguage(settings.primaryLanguage, settings);
}
