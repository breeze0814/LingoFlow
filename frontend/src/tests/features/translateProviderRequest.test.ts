import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, ToolProviderConfigMap } from '../../features/settings/settingsTypes';
import { buildEnabledTranslateProviderConfigs } from '../../features/settings/translateProviderRequest';

describe('translateProviderRequest', () => {
  it('collects enabled translate providers in UI order', () => {
    const providers: ToolProviderConfigMap = {
      ...DEFAULT_SETTINGS.providers,
      bing_web: { ...DEFAULT_SETTINGS.providers.bing_web, enabled: true },
      deepl_free: {
        ...DEFAULT_SETTINGS.providers.deepl_free,
        enabled: true,
        apiKey: 'deepl-key',
      },
      azure_translator: {
        ...DEFAULT_SETTINGS.providers.azure_translator,
        enabled: false,
      },
      google_translate: {
        ...DEFAULT_SETTINGS.providers.google_translate,
        enabled: true,
        apiKey: 'google-key',
      },
    };

    expect(buildEnabledTranslateProviderConfigs(providers)).toEqual([
      { id: 'youdao_web' },
      { id: 'bing_web' },
      {
        id: 'deepl_free',
        apiKey: 'deepl-key',
        baseUrl: 'https://api-free.deepl.com/v2/translate',
      },
      {
        id: 'google_translate',
        apiKey: 'google-key',
        baseUrl: 'https://translation.googleapis.com/language/translate/v2',
      },
    ]);
  });
});
