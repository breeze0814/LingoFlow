import { ToolProviderConfigMap, TranslateProviderId } from './settingsTypes';

export type TranslateProviderRequestConfig = {
  id: TranslateProviderId;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  region?: string;
  secretId?: string;
  secretKey?: string;
  appId?: string;
  appSecret?: string;
};

export const TRANSLATE_PROVIDER_ORDER: TranslateProviderId[] = [
  'openai_compatible',
  'youdao_web',
  'bing_web',
  'deepl_free',
  'azure_translator',
  'google_translate',
  'tencent_tmt',
  'baidu_fanyi',
];

function withDefinedFields(config: TranslateProviderRequestConfig): TranslateProviderRequestConfig {
  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined),
  ) as TranslateProviderRequestConfig;
}

export function buildEnabledTranslateProviderConfigs(
  providers: ToolProviderConfigMap,
): TranslateProviderRequestConfig[] {
  return TRANSLATE_PROVIDER_ORDER.filter((providerId) => providers[providerId].enabled).map(
    (providerId) => {
      const provider = providers[providerId];
      return withDefinedFields({
        id: providerId,
        apiKey: provider.apiKey || undefined,
        baseUrl: provider.baseUrl || undefined,
        model: provider.model || undefined,
        region: provider.region || undefined,
        secretId: provider.secretId || undefined,
        secretKey: provider.secretKey || undefined,
        appId: provider.appId || undefined,
        appSecret: provider.appSecret || undefined,
      });
    },
  );
}

export function buildEnabledTranslateProviderIds(
  providers: ToolProviderConfigMap,
): TranslateProviderId[] {
  return TRANSLATE_PROVIDER_ORDER.filter((providerId) => providers[providerId].enabled);
}
