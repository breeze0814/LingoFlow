import { ToolProviderConfigMap, ToolProviderId } from './settingsTypes';

export type TranslateProviderRequestConfig = {
  id: Exclude<ToolProviderId, 'localOcr'>;
  apiKey?: string;
  baseUrl?: string;
  region?: string;
  secretId?: string;
  secretKey?: string;
  appId?: string;
  appSecret?: string;
};

const TRANSLATE_PROVIDER_ORDER: Array<Exclude<ToolProviderId, 'localOcr'>> = [
  'youdao_web',
  'bing_web',
  'deepl_free',
  'azure_translator',
  'google_translate',
  'tencent_tmt',
  'baidu_fanyi',
];

export function buildEnabledTranslateProviderConfigs(
  providers: ToolProviderConfigMap,
): TranslateProviderRequestConfig[] {
  return TRANSLATE_PROVIDER_ORDER.filter((providerId) => providers[providerId].enabled).map(
    (providerId) => {
      const provider = providers[providerId];
      return {
        id: providerId,
        apiKey: provider.apiKey || undefined,
        baseUrl: provider.baseUrl || undefined,
        region: provider.region || undefined,
        secretId: provider.secretId || undefined,
        secretKey: provider.secretKey || undefined,
        appId: provider.appId || undefined,
        appSecret: provider.appSecret || undefined,
      };
    },
  );
}

export function buildEnabledTranslateProviderIds(
  providers: ToolProviderConfigMap,
): Array<Exclude<ToolProviderId, 'localOcr'>> {
  return TRANSLATE_PROVIDER_ORDER.filter((providerId) => providers[providerId].enabled);
}
