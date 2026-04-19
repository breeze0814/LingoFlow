import {
  DEFAULT_SETTINGS,
  DEFAULT_SHORTCUTS,
  DEFAULT_TOOL_PROVIDERS,
  DetectionMode,
  EnglishVoice,
  OcrProviderId,
  OcrPanelPosition,
  SettingsState,
  ShortcutConfig,
  ToolProviderConfig,
  ToolProviderConfigMap,
  ToolProviderId,
  TranslateProviderId,
} from './settingsTypes';
import { OCR_PROVIDER_ORDER } from './ocrProviderRequest';
import { TRANSLATE_PROVIDER_ORDER } from './translateProviderRequest';

const SETTINGS_STORAGE_KEY = 'lingoflow.settings.v1';

type SettingsRecord = Record<string, unknown>;
const SECRET_PROVIDER_FIELDS: Record<ToolProviderId, Array<keyof ToolProviderConfig>> = {
  localOcr: [],
  openai_compatible_ocr: ['apiKey'],
  openai_compatible: ['apiKey'],
  youdao_web: [],
  bing_web: [],
  deepl_free: ['apiKey'],
  azure_translator: ['apiKey'],
  google_translate: ['apiKey'],
  tencent_tmt: ['secretId', 'secretKey'],
  baidu_fanyi: ['appId', 'appSecret'],
};

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

function parseNumber(value: unknown, key: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
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

function parseOcrPanelPosition(value: unknown): OcrPanelPosition {
  if (value === undefined) {
    return DEFAULT_SETTINGS.ocrPanelPosition;
  }
  if (value === 'cursor') {
    return 'center';
  }
  if (value === 'top_left' || value === 'top_right' || value === 'center') {
    return value;
  }
  throw new Error('invalid settings field: ocrPanelPosition');
}

function parseTranslateProviderId(value: unknown): TranslateProviderId {
  if (
    value === 'openai_compatible' ||
    value === 'youdao_web' ||
    value === 'bing_web' ||
    value === 'deepl_free' ||
    value === 'azure_translator' ||
    value === 'google_translate' ||
    value === 'tencent_tmt' ||
    value === 'baidu_fanyi'
  ) {
    return value;
  }
  throw new Error('invalid settings field: defaultTranslateProvider');
}

function parseOcrProviderId(value: unknown): OcrProviderId {
  if (value === 'localOcr' || value === 'openai_compatible_ocr') {
    return value;
  }
  throw new Error('invalid settings field: defaultOcrProvider');
}

function parseShortcuts(value: unknown): ShortcutConfig {
  if (value === undefined) {
    return { ...DEFAULT_SHORTCUTS };
  }
  if (!isSettingsRecord(value)) {
    throw new Error('invalid settings field: shortcuts');
  }

  const shortcuts: ShortcutConfig = {
    inputTranslate: parseString(value.inputTranslate, 'shortcuts.inputTranslate'),
    ocrTranslate: parseString(value.ocrTranslate, 'shortcuts.ocrTranslate'),
    selectionTranslate: parseString(value.selectionTranslate, 'shortcuts.selectionTranslate'),
    ocrRecognize: parseString(value.ocrRecognize, 'shortcuts.ocrRecognize'),
    hideInterface: parseString(value.hideInterface, 'shortcuts.hideInterface'),
    openSettings: parseString(value.openSettings, 'shortcuts.openSettings'),
  };

  return migrateLegacyShortcuts(migratePreviousDefaultShortcuts(shortcuts));
}

function normalizeShortcut(shortcut: string): string {
  return shortcut.replace(/\s+/g, '').toLowerCase();
}

function isLegacyDefaultShortcutPair(shortcuts: ShortcutConfig): boolean {
  return (
    normalizeShortcut(shortcuts.inputTranslate) === normalizeShortcut('Option + A') &&
    normalizeShortcut(shortcuts.ocrTranslate) === normalizeShortcut('Option + S')
  );
}

function migrateLegacyShortcuts(shortcuts: ShortcutConfig): ShortcutConfig {
  if (!isLegacyDefaultShortcutPair(shortcuts)) {
    return shortcuts;
  }
  return {
    ...shortcuts,
    inputTranslate: DEFAULT_SHORTCUTS.inputTranslate,
    ocrTranslate: DEFAULT_SHORTCUTS.ocrTranslate,
  };
}

function isPreviousDefaultShortcutSet(shortcuts: ShortcutConfig): boolean {
  return (
    normalizeShortcut(shortcuts.inputTranslate) === normalizeShortcut('Option + S') &&
    normalizeShortcut(shortcuts.ocrTranslate) === normalizeShortcut('Option + Q') &&
    normalizeShortcut(shortcuts.hideInterface) === normalizeShortcut('Option + F')
  );
}

function migratePreviousDefaultShortcuts(shortcuts: ShortcutConfig): ShortcutConfig {
  if (!isPreviousDefaultShortcutSet(shortcuts)) {
    return shortcuts;
  }
  return {
    ...shortcuts,
    inputTranslate: DEFAULT_SHORTCUTS.inputTranslate,
    ocrTranslate: DEFAULT_SHORTCUTS.ocrTranslate,
    hideInterface: DEFAULT_SHORTCUTS.hideInterface,
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
    enabled:
      value.enabled === undefined
        ? fallback.enabled
        : parseBoolean(value.enabled, `providers.${key}.enabled`),
    apiKey:
      value.apiKey === undefined
        ? fallback.apiKey
        : parseString(value.apiKey, `providers.${key}.apiKey`),
    baseUrl:
      value.baseUrl === undefined
        ? fallback.baseUrl
        : parseString(value.baseUrl, `providers.${key}.baseUrl`),
    model:
      value.model === undefined
        ? fallback.model
        : parseString(value.model, `providers.${key}.model`),
    region:
      value.region === undefined
        ? fallback.region
        : parseString(value.region, `providers.${key}.region`),
    secretId:
      value.secretId === undefined
        ? fallback.secretId
        : parseString(value.secretId, `providers.${key}.secretId`),
    secretKey:
      value.secretKey === undefined
        ? fallback.secretKey
        : parseString(value.secretKey, `providers.${key}.secretKey`),
    appId:
      value.appId === undefined
        ? fallback.appId
        : parseString(value.appId, `providers.${key}.appId`),
    appSecret:
      value.appSecret === undefined
        ? fallback.appSecret
        : parseString(value.appSecret, `providers.${key}.appSecret`),
  };
}

function parseProviders(value: unknown): ToolProviderConfigMap {
  if (value === undefined) {
    return {
      localOcr: parseProviderConfig(undefined, 'localOcr'),
      openai_compatible_ocr: parseProviderConfig(undefined, 'openai_compatible_ocr'),
      openai_compatible: parseProviderConfig(undefined, 'openai_compatible'),
      youdao_web: parseProviderConfig(undefined, 'youdao_web'),
      bing_web: parseProviderConfig(undefined, 'bing_web'),
      deepl_free: parseProviderConfig(undefined, 'deepl_free'),
      azure_translator: parseProviderConfig(undefined, 'azure_translator'),
      google_translate: parseProviderConfig(undefined, 'google_translate'),
      tencent_tmt: parseProviderConfig(undefined, 'tencent_tmt'),
      baidu_fanyi: parseProviderConfig(undefined, 'baidu_fanyi'),
    };
  }
  if (!isSettingsRecord(value)) {
    throw new Error('invalid settings field: providers');
  }
  const legacyDeepL = value.deepLTranslate;
  return {
    localOcr: parseProviderConfig(value.localOcr, 'localOcr'),
    openai_compatible_ocr: parseProviderConfig(
      value.openai_compatible_ocr,
      'openai_compatible_ocr',
    ),
    openai_compatible: parseProviderConfig(value.openai_compatible, 'openai_compatible'),
    youdao_web: parseProviderConfig(value.youdao_web, 'youdao_web'),
    bing_web: parseProviderConfig(value.bing_web, 'bing_web'),
    deepl_free: parseProviderConfig(value.deepl_free ?? legacyDeepL, 'deepl_free'),
    azure_translator: parseProviderConfig(value.azure_translator, 'azure_translator'),
    google_translate: parseProviderConfig(value.google_translate, 'google_translate'),
    tencent_tmt: parseProviderConfig(value.tencent_tmt, 'tencent_tmt'),
    baidu_fanyi: parseProviderConfig(value.baidu_fanyi, 'baidu_fanyi'),
  };
}

function parseSettings(record: SettingsRecord): SettingsState {
  return normalizeSettings({
    primaryLanguage: parseString(record.primaryLanguage, 'primaryLanguage'),
    secondaryLanguage: parseString(record.secondaryLanguage, 'secondaryLanguage'),
    defaultTranslateProvider:
      record.defaultTranslateProvider === undefined
        ? DEFAULT_SETTINGS.defaultTranslateProvider
        : parseTranslateProviderId(record.defaultTranslateProvider),
    defaultOcrProvider:
      record.defaultOcrProvider === undefined
        ? DEFAULT_SETTINGS.defaultOcrProvider
        : parseOcrProviderId(record.defaultOcrProvider),
    httpApiPort:
      record.httpApiPort === undefined
        ? DEFAULT_SETTINGS.httpApiPort
        : parseNumber(record.httpApiPort, 'httpApiPort'),
    detectionMode: parseDetectionMode(record.detectionMode),
    ocrPanelPosition: parseOcrPanelPosition(record.ocrPanelPosition),
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
  });
}

/**
 * Parses and validates stored settings from localStorage or Tauri store.
 *
 * This function:
 * 1. Validates the structure and types of all settings fields
 * 2. Applies default values for missing optional fields
 * 3. Migrates legacy settings formats (e.g., old shortcut defaults)
 * 4. Normalizes provider selections to ensure enabled providers are selected
 * 5. Throws descriptive errors for invalid data
 *
 * The parser is strict about required fields but lenient about optional ones,
 * falling back to defaults when values are missing or undefined.
 *
 * Legacy migrations handled:
 * - Old shortcut key combinations (Option+A/S → Option+S/Q)
 * - Previous default shortcuts (Option+S/Q/F → new defaults)
 * - Renamed provider IDs (deepLTranslate → deepl_free)
 * - Deprecated panel positions (cursor → center)
 *
 * @param value - The raw stored settings object (from JSON.parse)
 * @returns Validated and normalized settings state
 * @throws {Error} If settings structure is invalid or required fields are missing
 *
 * @example
 * ```ts
 * const raw = JSON.parse(localStorage.getItem('lingoflow.settings.v1'));
 * const settings = parseStoredSettings(raw);
 * // Returns: SettingsState with all fields validated and normalized
 * ```
 */
export function parseStoredSettings(value: unknown): SettingsState {
  if (!isSettingsRecord(value)) {
    throw new Error('settings storage payload is not object');
  }
  return parseSettings(value);
}

function firstEnabledTranslateProvider(
  providers: ToolProviderConfigMap,
): TranslateProviderId | null {
  for (const providerId of TRANSLATE_PROVIDER_ORDER) {
    if (providers[providerId].enabled) {
      return providerId;
    }
  }
  return null;
}

function firstEnabledOcrProvider(providers: ToolProviderConfigMap): OcrProviderId | null {
  for (const providerId of OCR_PROVIDER_ORDER) {
    if (providers[providerId].enabled) {
      return providerId;
    }
  }
  return null;
}

export function normalizeSettings(settings: SettingsState): SettingsState {
  const defaultTranslateProvider = settings.providers[settings.defaultTranslateProvider].enabled
    ? settings.defaultTranslateProvider
    : (firstEnabledTranslateProvider(settings.providers) ??
      DEFAULT_SETTINGS.defaultTranslateProvider);
  const defaultOcrProvider = settings.providers[settings.defaultOcrProvider].enabled
    ? settings.defaultOcrProvider
    : (firstEnabledOcrProvider(settings.providers) ?? DEFAULT_SETTINGS.defaultOcrProvider);

  return {
    ...settings,
    defaultTranslateProvider,
    defaultOcrProvider,
  };
}

export function redactSensitiveSettings(settings: SettingsState): SettingsState {
  const providers = Object.entries(settings.providers).reduce<ToolProviderConfigMap>(
    (result, [providerId, provider]) => {
      const typedProviderId = providerId as ToolProviderId;
      const nextProvider = { ...provider };
      for (const secretField of SECRET_PROVIDER_FIELDS[typedProviderId]) {
        switch (secretField) {
          case 'apiKey':
            nextProvider.apiKey = '';
            break;
          case 'secretId':
            nextProvider.secretId = '';
            break;
          case 'secretKey':
            nextProvider.secretKey = '';
            break;
          case 'appId':
            nextProvider.appId = '';
            break;
          case 'appSecret':
            nextProvider.appSecret = '';
            break;
          default:
            break;
        }
      }
      result[typedProviderId] = nextProvider;
      return result;
    },
    {} as ToolProviderConfigMap,
  );

  return {
    ...settings,
    providers,
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
    return parseStoredSettings(parsed);
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
