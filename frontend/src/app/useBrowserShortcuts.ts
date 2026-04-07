import { type RefObject, useEffect } from 'react';
import { matchesShortcut } from '../features/settings/shortcutMatcher';
import { type ShortcutConfig } from '../features/settings/settingsTypes';
import {
  hasActiveModifiers,
  isShortcutRecording,
  isTauriRuntime,
  shouldSkipKeybindingTarget,
  type ShortcutAction,
} from './appRuntime';

type UseBrowserShortcutsInput = {
  executeShortcutAction: (action: ShortcutAction) => void;
  pendingShortcutActionRef: RefObject<ShortcutAction | null>;
  shortcuts: ShortcutConfig;
};

export function useBrowserShortcuts(input: UseBrowserShortcutsInput) {
  const { executeShortcutAction, pendingShortcutActionRef, shortcuts } = input;

  useEffect(() => {
    if (isTauriRuntime()) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (isShortcutRecording() || shouldSkipKeybindingTarget(event.target)) {
        return;
      }

      const pendingAction = matchShortcutAction(event, shortcuts);
      if (!pendingAction) {
        return;
      }

      event.preventDefault();
      pendingShortcutActionRef.current = pendingAction;
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const pendingAction = pendingShortcutActionRef.current;
      if (!pendingAction || hasActiveModifiers(event)) {
        return;
      }
      pendingShortcutActionRef.current = null;
      executeShortcutAction(pendingAction);
    };

    const onWindowBlur = () => {
      pendingShortcutActionRef.current = null;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [executeShortcutAction, pendingShortcutActionRef, shortcuts]);
}

function matchShortcutAction(
  event: KeyboardEvent,
  shortcuts: ShortcutConfig,
): ShortcutAction | null {
  if (matchesShortcut(event, shortcuts.inputTranslate)) {
    return 'input_translate';
  }
  if (matchesShortcut(event, shortcuts.ocrTranslate)) {
    return 'ocr_translate';
  }
  if (matchesShortcut(event, shortcuts.hideInterface)) {
    return 'hide_interface';
  }
  if (matchesShortcut(event, shortcuts.selectionTranslate)) {
    return 'selection_translate';
  }
  if (matchesShortcut(event, shortcuts.ocrRecognize)) {
    return 'ocr_recognize';
  }
  if (matchesShortcut(event, shortcuts.openSettings)) {
    return 'open_settings';
  }
  return null;
}
