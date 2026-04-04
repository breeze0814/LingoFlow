import { beforeEach, describe, expect, it } from 'vitest';
import { loadSettingsFromStorage } from '../../features/settings/settingsStorage';
import { DEFAULT_SETTINGS } from '../../features/settings/settingsTypes';

const SETTINGS_STORAGE_KEY = 'lingoflow.settings.v1';

describe('settingsStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('migrates legacy default shortcuts to current defaults', () => {
    const legacySettings = {
      ...DEFAULT_SETTINGS,
      shortcuts: {
        ...DEFAULT_SETTINGS.shortcuts,
        inputTranslate: 'Option + A',
        ocrTranslate: 'Option + S',
      },
    };
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(legacySettings));

    const loaded = loadSettingsFromStorage();

    expect(loaded.shortcuts.inputTranslate).toBe('Option + F');
    expect(loaded.shortcuts.ocrTranslate).toBe('Option + S');
  });

  it('keeps custom shortcuts unchanged during migration', () => {
    const customSettings = {
      ...DEFAULT_SETTINGS,
      shortcuts: {
        ...DEFAULT_SETTINGS.shortcuts,
        inputTranslate: 'Option + Z',
        ocrTranslate: 'Option + S',
      },
    };
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(customSettings));

    const loaded = loadSettingsFromStorage();

    expect(loaded.shortcuts.inputTranslate).toBe('Option + Z');
    expect(loaded.shortcuts.ocrTranslate).toBe('Option + S');
  });

  it('migrates previous default shortcuts to the current defaults', () => {
    const previousDefaults = {
      ...DEFAULT_SETTINGS,
      shortcuts: {
        ...DEFAULT_SETTINGS.shortcuts,
        inputTranslate: 'Option + S',
        ocrTranslate: 'Option + Q',
        hideInterface: 'Option + F',
      },
    };
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(previousDefaults));

    const loaded = loadSettingsFromStorage();

    expect(loaded.shortcuts.inputTranslate).toBe('Option + F');
    expect(loaded.shortcuts.ocrTranslate).toBe('Option + S');
    expect(loaded.shortcuts.hideInterface).toBe('Option + Q');
  });
});
