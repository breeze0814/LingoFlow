export const PROVIDER_LABEL_MAP: Record<string, string> = {
  youdao_web: '有道翻译',
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
    icon: '📘',
    color: '#0c7a9e',
  },
  deepl_free: {
    label: 'DeepL 翻译',
    icon: '🔷',
    color: '#0f2b46',
  },
  google_translate: {
    label: 'Google 翻译',
    icon: '🌐',
    color: '#4285f4',
  },
  tencent_tmt: {
    label: '腾讯翻译',
    icon: '🐧',
    color: '#00a4ff',
  },
  baidu_fanyi: {
    label: '百度翻译',
    icon: '🐻',
    color: '#2932e1',
  },
  azure_translator: {
    label: 'Azure 翻译',
    icon: '☁️',
    color: '#0078d4',
  },
  openai_compatible: {
    label: 'OpenAI 兼容翻译',
    icon: '🤖',
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
      icon: '🔧',
      color: '#6b7280',
    }
  );
}
