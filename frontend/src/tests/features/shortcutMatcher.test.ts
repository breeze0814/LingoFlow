import { describe, expect, it } from 'vitest';
import {
  getShortcutEventKey,
  matchesShortcut,
  parseShortcutPattern,
} from '../../features/settings/shortcutMatcher';

describe('shortcutMatcher', () => {
  it('parses common shortcut formats', () => {
    expect(parseShortcutPattern('Option + S')).toEqual({
      key: 'S',
      meta: false,
      ctrl: false,
      alt: true,
      shift: false,
      metaOrCtrl: false,
    });
    expect(parseShortcutPattern('Cmd/Ctrl + ,')).toEqual({
      key: ',',
      meta: false,
      ctrl: false,
      alt: false,
      shift: false,
      metaOrCtrl: true,
    });
  });

  it('matches option shortcut', () => {
    const event = new KeyboardEvent('keydown', { key: 'ß', code: 'KeyS', altKey: true });
    expect(matchesShortcut(event, 'Option + S')).toBe(true);
    expect(matchesShortcut(event, 'Shift + Option + S')).toBe(false);
  });

  it('prefers keyboard code over localized key value', () => {
    const event = new KeyboardEvent('keydown', { key: 'å', code: 'KeyA', altKey: true });
    expect(getShortcutEventKey(event)).toBe('A');
  });

  it('matches cmd or ctrl shortcut', () => {
    const ctrlEvent = new KeyboardEvent('keydown', { key: ',', ctrlKey: true });
    const cmdEvent = new KeyboardEvent('keydown', { key: ',', metaKey: true });
    expect(matchesShortcut(ctrlEvent, 'Cmd/Ctrl + ,')).toBe(true);
    expect(matchesShortcut(cmdEvent, 'Cmd/Ctrl + ,')).toBe(true);
  });
});
