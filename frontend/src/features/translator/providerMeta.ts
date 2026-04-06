export const PROVIDER_LABEL_MAP: Record<string, string> = {
  youdao_web: '有道翻译',
  bing_web: 'Bing 翻译',
  deepl_free: 'DeepL 翻译',
  google_translate: 'Google 翻译',
  tencent_tmt: '腾讯翻译',
  baidu_fanyi: '百度翻译',
  azure_translator: 'Azure 翻译',
  openai_compatible: 'OpenAI 兼容翻译',
};

export type ProviderMeta = {
  label: string;
  icon: string;
  color: string;
};

export const PROVIDER_META: Record<string, ProviderMeta> = {
  youdao_web: {
    label: '有道翻译',
    icon: 'youdao',
    color: '#0c7a9e',
  },
  bing_web: {
    label: 'Bing 翻译',
    icon: 'bing',
    color: '#008373',
  },
  deepl_free: {
    label: 'DeepL 翻译',
    icon: 'deepl',
    color: '#0f2b46',
  },
  google_translate: {
    label: 'Google 翻译',
    icon: 'google',
    color: '#4285f4',
  },
  tencent_tmt: {
    label: '腾讯翻译',
    icon: 'tencent',
    color: '#00a4ff',
  },
  baidu_fanyi: {
    label: '百度翻译',
    icon: 'baidu',
    color: '#2932e1',
  },
  azure_translator: {
    label: 'Azure 翻译',
    icon: 'azure',
    color: '#0078d4',
  },
  openai_compatible: {
    label: 'OpenAI 兼容翻译',
    icon: 'openai',
    color: '#10a37f',
  },
};

export function providerLabel(providerId: string): string {
  return PROVIDER_LABEL_MAP[providerId] ?? providerId;
}

export function providerMeta(providerId: string): ProviderMeta {
  return (
    PROVIDER_META[providerId] ?? {
      label: providerId,
      icon: 'default',
      color: '#6b7280',
    }
  );
}
