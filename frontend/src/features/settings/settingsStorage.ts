import {
  DEFAULT_SETTINGS,
  DEFAULT_SHORTCUTS,
  DEFAULT_TOOL_PROVIDERS,
  DetectionMode,
  EnglishVoice,
  SettingsState,
  ShortcutConfig,
  ToolProviderConfig,
  ToolProviderConfigMap,
  ToolProviderId,
} from './settingsTypes';

const SETTINGS_STORAGE_KEY = 'lingoflow.settings.v1';

type SettingsRecord = Record<string, unknown>;

function isSettingsRecord(value: unknown): value is SettingsRecord {
  return typeof value === 'object' && value !== null;
}

function parseString(value: unknown, key: string): string {
  if (typeof value !== 'string') {
    throw new Error(`invalid settings field: ${key}`);
  }
  return value;
}

function parseBoolean(value: unknown, key: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`invalid settings field: ${key}`);
  }
  return value;
}

function parseDetectionMode(value: unknown): DetectionMode {
  if (value === 'system_only' || value === 'auto') {
    return value;
  }
  throw new Error('invalid settings field: detectionMode');
}

function parseEnglishVoice(value: unknown): EnglishVoice {
  if (value === 'us' || value === 'uk') {
    return value;
  }
  throw new Error('invalid settings field: englishVoice');
}

function parseShortcuts(value: unknown): ShortcutConfig {
  if (value === undefined) {
    return { ...DEFAULT_SHORTCUTS };
  }
  if (!isSettingsRecord(value)) {
    throw new Error('invalid settings field: shortcuts');
  }

  return {
    inputTranslate: parseString(value.inputTranslate, 'shortcuts.inputTranslate'),
    ocrTranslate: parseString(value.ocrTranslate, 'shortcuts.ocrTranslate'),
    selectionTranslate: parseString(value.selectionTranslate, 'shortcuts.selectionTranslate'),
    ocrRecognize: parseString(value.ocrRecognize, 'shortcuts.ocrRecognize'),
    showMainWindow: parseString(value.showMainWindow, 'shortcuts.showMainWindow'),
    openSettings: parseString(value.openSettings, 'shortcuts.openSettings'),
  };
}

function parseProviderConfig(value: unknown, key: ToolProviderId): ToolProviderConfig {
  const fallback = DEFAULT_TOOL_PROVIDERS[key];
  if (value === undefined) {
    return { ...fallback };
  }
  if (!isSettingsRecord(value)) {
    throw new Error(`invalid settings field: providers.${key}`);
  }
  return {
    enabled: parseBoolean(value.enabled, `providers.${key}.enabled`),
    apiKey: parseString(value.apiKey, `providers.${key}.apiKey`),
    baseUrl: parseString(value.baseUrl, `providers.${key}.baseUrl`),
    model: parseString(value.model, `providers.${key}.model`),
  };
}

function parseProviders(value: unknown): ToolProviderConfigMap {
  if (value === undefined) {
    return {
      localOcr: parseProviderConfig(undefined, 'localOcr'),
      deepLTranslate: parseProviderConfig(undefined, 'deepLTranslate'),
    };
  }
  if (!isSettingsRecord(value)) {
    throw new Error('invalid settings field: providers');
  }
  return {
    localOcr: parseProviderConfig(value.localOcr, 'localOcr'),
    deepLTranslate: parseProviderConfig(value.deepLTranslate, 'deepLTranslate'),
  };
}

function parseSettings(record: SettingsRecord): SettingsState {
  return {
    primaryLanguage: parseString(record.primaryLanguage, 'primaryLanguage'),
    secondaryLanguage: parseString(record.secondaryLanguage, 'secondaryLanguage'),
    detectionMode: parseDetectionMode(record.detectionMode),
    clearInputOnTranslate: parseBoolean(record.clearInputOnTranslate, 'clearInputOnTranslate'),
    keepResultForSelection: parseBoolean(record.keepResultForSelection, 'keepResultForSelection'),
    autoSelectQueryTextOnOpen: parseBoolean(
      record.autoSelectQueryTextOnOpen,
      'autoSelectQueryTextOnOpen',
    ),
    autoQueryOnSelection: parseBoolean(record.autoQueryOnSelection, 'autoQueryOnSelection'),
    autoQueryOnOcr: parseBoolean(record.autoQueryOnOcr, 'autoQueryOnOcr'),
    autoQueryOnPaste: parseBoolean(record.autoQueryOnPaste, 'autoQueryOnPaste'),
    autoSpeakEnglishWord: parseBoolean(record.autoSpeakEnglishWord, 'autoSpeakEnglishWord'),
    englishVoice: parseEnglishVoice(record.englishVoice),
    autoCopyResult: parseBoolean(record.autoCopyResult, 'autoCopyResult'),
    httpApiEnabled: parseBoolean(record.httpApiEnabled, 'httpApiEnabled'),
    shortcuts: parseShortcuts(record.shortcuts),
    providers: parseProviders(record.providers),
  };
}

export function loadSettingsFromStorage(): SettingsState {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!isSettingsRecord(parsed)) {
      throw new Error('settings storage payload is not object');
    }
    return parseSettings(parsed);
  } catch (error) {
    console.error('failed to load settings from storage', error);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettingsToStorage(settings: SettingsState) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('failed to save settings to storage', error);
  }
}
