import { OcrProviderId, ToolProviderConfigMap } from './settingsTypes';

export type OcrProviderRequestConfig = {
  id: 'openai_compatible_ocr';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export const OCR_PROVIDER_ORDER: OcrProviderId[] = ['localOcr', 'openai_compatible_ocr'];

function withDefinedFields(config: OcrProviderRequestConfig): OcrProviderRequestConfig {
  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined),
  ) as OcrProviderRequestConfig;
}

export function buildEnabledOcrProviderConfigs(
  providers: ToolProviderConfigMap,
): OcrProviderRequestConfig[] {
  if (!providers.openai_compatible_ocr.enabled) {
    return [];
  }
  return [
    withDefinedFields({
      id: 'openai_compatible_ocr',
      apiKey: providers.openai_compatible_ocr.apiKey || undefined,
      baseUrl: providers.openai_compatible_ocr.baseUrl || undefined,
      model: providers.openai_compatible_ocr.model || undefined,
    }),
  ];
}

export function resolveOcrProviderRequestId(providerId: OcrProviderId): string | undefined {
  if (providerId === 'openai_compatible_ocr') {
    return providerId;
  }
  return undefined;
}
