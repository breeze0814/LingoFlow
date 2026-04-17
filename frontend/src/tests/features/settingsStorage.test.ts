import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadSettingsFromStorage,
  normalizeSettings,
  redactSensitiveSettings,
} from '../../features/settings/settingsStorage';
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

  it('exposes the full translate provider set in default settings', () => {
    expect(Object.keys(DEFAULT_SETTINGS.providers)).toEqual([
      'localOcr',
      'openai_compatible_ocr',
      'openai_compatible',
      'youdao_web',
      'bing_web',
      'deepl_free',
      'azure_translator',
      'google_translate',
      'tencent_tmt',
      'baidu_fanyi',
    ]);
    expect(DEFAULT_SETTINGS.defaultTranslateProvider).toBe('youdao_web');
    expect(DEFAULT_SETTINGS.defaultOcrProvider).toBe('localOcr');
    expect(DEFAULT_SETTINGS.httpApiPort).toBe(61928);
  });

  it('migrates legacy deepLTranslate settings into deepl_free', () => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        providers: {
          localOcr: {
            enabled: true,
            apiKey: '',
            baseUrl: '',
            model: '',
          },
          deepLTranslate: {
            enabled: true,
            apiKey: 'deepl-legacy-key',
            baseUrl: 'https://api-free.deepl.com/v2',
            model: '',
          },
        },
      }),
    );

    const loaded = loadSettingsFromStorage();

    expect(loaded.providers.deepl_free.enabled).toBe(true);
    expect(loaded.providers.deepl_free.apiKey).toBe('deepl-legacy-key');
    expect(loaded.providers.deepl_free.baseUrl).toBe('https://api-free.deepl.com/v2');
  });

  it('redacts provider secrets before browser storage caching', () => {
    const redacted = redactSensitiveSettings({
      ...DEFAULT_SETTINGS,
      providers: {
        ...DEFAULT_SETTINGS.providers,
        deepl_free: {
          ...DEFAULT_SETTINGS.providers.deepl_free,
          enabled: true,
          apiKey: 'deepl-secret',
        },
        azure_translator: {
          ...DEFAULT_SETTINGS.providers.azure_translator,
          apiKey: 'azure-secret',
          region: 'eastasia',
        },
        tencent_tmt: {
          ...DEFAULT_SETTINGS.providers.tencent_tmt,
          secretId: 'secret-id',
          secretKey: 'secret-key',
          region: 'ap-shanghai',
        },
        baidu_fanyi: {
          ...DEFAULT_SETTINGS.providers.baidu_fanyi,
          appId: 'baidu-app',
          appSecret: 'baidu-secret',
        },
      },
    });

    expect(redacted.providers.deepl_free.apiKey).toBe('');
    expect(redacted.providers.azure_translator.apiKey).toBe('');
    expect(redacted.providers.azure_translator.region).toBe('eastasia');
    expect(redacted.providers.tencent_tmt.secretId).toBe('');
    expect(redacted.providers.tencent_tmt.secretKey).toBe('');
    expect(redacted.providers.tencent_tmt.region).toBe('ap-shanghai');
    expect(redacted.providers.baidu_fanyi.appId).toBe('');
    expect(redacted.providers.baidu_fanyi.appSecret).toBe('');
  });

  it('normalizes default providers when the current defaults are disabled', () => {
    const normalized = normalizeSettings({
      ...DEFAULT_SETTINGS,
      defaultTranslateProvider: 'youdao_web',
      defaultOcrProvider: 'localOcr',
      providers: {
        ...DEFAULT_SETTINGS.providers,
        localOcr: { ...DEFAULT_SETTINGS.providers.localOcr, enabled: false },
        openai_compatible_ocr: {
          ...DEFAULT_SETTINGS.providers.openai_compatible_ocr,
          enabled: true,
        },
        youdao_web: { ...DEFAULT_SETTINGS.providers.youdao_web, enabled: false },
        bing_web: { ...DEFAULT_SETTINGS.providers.bing_web, enabled: true },
      },
    });

    expect(normalized.defaultTranslateProvider).toBe('bing_web');
    expect(normalized.defaultOcrProvider).toBe('openai_compatible_ocr');
  });
});
