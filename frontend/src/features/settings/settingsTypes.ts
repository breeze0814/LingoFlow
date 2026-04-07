export type DetectionMode = 'system_only' | 'auto';

export type EnglishVoice = 'us' | 'uk';
export type OcrPanelPosition = 'top_left' | 'top_right' | 'center';

export type ShortcutId =
  | 'inputTranslate'
  | 'ocrTranslate'
  | 'selectionTranslate'
  | 'ocrRecognize'
  | 'hideInterface'
  | 'openSettings';

export type ShortcutConfig = Record<ShortcutId, string>;

export type ToolProviderId =
  | 'localOcr'
  | 'youdao_web'
  | 'bing_web'
  | 'deepl_free'
  | 'azure_translator'
  | 'google_translate'
  | 'tencent_tmt'
  | 'baidu_fanyi';

export type ToolProviderFieldKey =
  | 'apiKey'
  | 'baseUrl'
  | 'model'
  | 'region'
  | 'secretId'
  | 'secretKey'
  | 'appId'
  | 'appSecret';

export type ToolProviderFieldDefinition = {
  key: ToolProviderFieldKey;
  label: string;
  placeholder: string;
  secret?: boolean;
};

export type ToolProviderLinkDefinition = {
  label: string;
  url: string;
};

export type ToolProviderConfig = {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  region: string;
  secretId: string;
  secretKey: string;
  appId: string;
  appSecret: string;
};

export type ToolProviderConfigMap = Record<ToolProviderId, ToolProviderConfig>;

export type ToolProviderDefinition = {
  id: ToolProviderId;
  name: string;
  group: 'no_api_key' | 'requires_api_key';
  category: 'OCR' | '翻译';
  description: string;
  fields: ToolProviderFieldDefinition[];
  links: ToolProviderLinkDefinition[];
  helpText?: string;
};

export type SettingsState = {
  primaryLanguage: string;
  secondaryLanguage: string;
  detectionMode: DetectionMode;
  ocrPanelPosition: OcrPanelPosition;
  clearInputOnTranslate: boolean;
  keepResultForSelection: boolean;
  autoSelectQueryTextOnOpen: boolean;
  autoQueryOnSelection: boolean;
  autoQueryOnOcr: boolean;
  autoQueryOnPaste: boolean;
  autoSpeakEnglishWord: boolean;
  englishVoice: EnglishVoice;
  autoCopyResult: boolean;
  httpApiEnabled: boolean;
  shortcuts: ShortcutConfig;
  providers: ToolProviderConfigMap;
};

export type Option = {
  value: string;
  label: string;
};

const EMPTY_PROVIDER_FIELDS = {
  apiKey: '',
  baseUrl: '',
  model: '',
  region: '',
  secretId: '',
  secretKey: '',
  appId: '',
  appSecret: '',
} as const;

function createProviderConfig(
  enabled: boolean,
  fields: Partial<Omit<ToolProviderConfig, 'enabled'>> = {},
): ToolProviderConfig {
  return {
    enabled,
    ...EMPTY_PROVIDER_FIELDS,
    ...fields,
  };
}

export const LANGUAGE_OPTIONS: Option[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: '英语' },
  { value: 'ja', label: '日语' },
  { value: 'ko', label: '韩语' },
  { value: 'fr', label: '法语' },
  { value: 'de', label: '德语' },
];

export const DETECTION_OPTIONS: Option[] = [
  { value: 'system_only', label: '仅使用系统语种识别' },
  { value: 'auto', label: '自动检测并纠偏' },
];

export const VOICE_OPTIONS: Option[] = [
  { value: 'us', label: '美音' },
  { value: 'uk', label: '英音' },
];

export const OCR_PANEL_POSITION_OPTIONS: Option[] = [
  { value: 'top_left', label: '左上角' },
  { value: 'top_right', label: '右上角' },
  { value: 'center', label: '中间' },
];

export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  inputTranslate: 'Option + F',
  ocrTranslate: 'Option + S',
  selectionTranslate: 'Option + D',
  ocrRecognize: 'Shift + Option + S',
  hideInterface: 'Option + Q',
  openSettings: 'Cmd/Ctrl + ,',
};

export const TOOL_PROVIDER_DEFINITIONS: ToolProviderDefinition[] = [
  {
    id: 'localOcr',
    name: '本地 OCR',
    group: 'no_api_key',
    category: 'OCR',
    description: '使用系统 OCR 引擎，无需 API Key。',
    fields: [],
    links: [],
    helpText: '当前工具走系统本地能力，不需要配置 API Key。',
  },
  {
    id: 'youdao_web',
    name: 'Youdao翻译',
    group: 'no_api_key',
    category: '翻译',
    description: '直接使用有道网页翻译能力，无需官方 API Key。',
    fields: [],
    links: [{ label: '打开有道翻译网页', url: 'https://fanyi.youdao.com/' }],
    helpText: '网页源 provider 依赖网页端接口策略，无需单独配置密钥。',
  },
  {
    id: 'bing_web',
    name: 'Bing 翻译',
    group: 'no_api_key',
    category: '翻译',
    description: '直接使用 Bing Translator 网页翻译能力，无需官方 API Key。',
    fields: [],
    links: [{ label: '打开 Bing Translator', url: 'https://www.bing.com/translator' }],
    helpText: '网页源 provider 依赖网页端动态 token，无需单独配置密钥。',
  },
  {
    id: 'deepl_free',
    name: 'DeepL',
    group: 'requires_api_key',
    category: '翻译',
    description: '高质量文本翻译，运行时读取 DEEPL_API_KEY / DEEPL_BASE_URL。',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'deepl-...', secret: true },
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://api-free.deepl.com/v2/translate' },
    ],
    links: [{ label: '前往 DeepL 获取密钥', url: 'https://www.deepl.com/pro-api' }],
  },
  {
    id: 'azure_translator',
    name: 'Azure 翻译',
    group: 'requires_api_key',
    category: '翻译',
    description: 'Microsoft Translator 官方翻译 API，运行时读取 API Key / Region / Base URL。',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'azure-...', secret: true },
      { key: 'region', label: 'Region', placeholder: 'eastasia' },
      {
        key: 'baseUrl',
        label: 'Base URL',
        placeholder: 'https://api.cognitive.microsofttranslator.com',
      },
    ],
    links: [
      {
        label: '前往 Azure Translator 获取密钥',
        url: 'https://learn.microsoft.com/azure/ai-services/translator/text-translation/quickstart/client-library-sdk',
      },
    ],
  },
  {
    id: 'google_translate',
    name: 'Google 翻译',
    group: 'requires_api_key',
    category: '翻译',
    description: 'Google Cloud 官方翻译 API，运行时读取 GOOGLE_TRANSLATE_API_KEY / BASE_URL。',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'AIza...', secret: true },
      {
        key: 'baseUrl',
        label: 'Base URL',
        placeholder: 'https://translation.googleapis.com/language/translate/v2',
      },
    ],
    links: [
      { label: '前往 Google Cloud 获取密钥', url: 'https://cloud.google.com/translate/docs/setup' },
    ],
  },
  {
    id: 'tencent_tmt',
    name: '腾讯云翻译',
    group: 'requires_api_key',
    category: '翻译',
    description: '腾讯云机器翻译，运行时读取 SECRET_ID / SECRET_KEY / REGION / BASE_URL。',
    fields: [
      { key: 'secretId', label: 'Secret ID', placeholder: 'AKID...', secret: true },
      { key: 'secretKey', label: 'Secret Key', placeholder: '******', secret: true },
      { key: 'region', label: 'Region', placeholder: 'ap-guangzhou' },
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://tmt.tencentcloudapi.com' },
    ],
    links: [
      { label: '前往腾讯云机器翻译获取密钥', url: 'https://console.cloud.tencent.com/cam/capi' },
    ],
  },
  {
    id: 'baidu_fanyi',
    name: '百度翻译',
    group: 'requires_api_key',
    category: '翻译',
    description: '百度翻译开放平台，运行时读取 APP_ID / SECRET / BASE_URL。',
    fields: [
      { key: 'appId', label: 'App ID', placeholder: '2026xxxxxx', secret: true },
      { key: 'appSecret', label: 'Secret', placeholder: '******', secret: true },
      {
        key: 'baseUrl',
        label: 'Base URL',
        placeholder: 'https://fanyi-api.baidu.com/api/trans/vip/translate',
      },
    ],
    links: [
      {
        label: '前往百度翻译开放平台获取密钥',
        url: 'https://fanyi-api.baidu.com/manage/developer',
      },
    ],
  },
];

export const DEFAULT_TOOL_PROVIDERS: ToolProviderConfigMap = {
  localOcr: createProviderConfig(true),
  youdao_web: createProviderConfig(true),
  bing_web: createProviderConfig(true),
  deepl_free: createProviderConfig(false, { baseUrl: 'https://api-free.deepl.com/v2/translate' }),
  azure_translator: createProviderConfig(false, {
    baseUrl: 'https://api.cognitive.microsofttranslator.com',
  }),
  google_translate: createProviderConfig(false, {
    baseUrl: 'https://translation.googleapis.com/language/translate/v2',
  }),
  tencent_tmt: createProviderConfig(false, {
    region: 'ap-guangzhou',
    baseUrl: 'https://tmt.tencentcloudapi.com',
  }),
  baidu_fanyi: createProviderConfig(false, {
    baseUrl: 'https://fanyi-api.baidu.com/api/trans/vip/translate',
  }),
};

export const DEFAULT_SETTINGS: SettingsState = {
  primaryLanguage: 'zh-CN',
  secondaryLanguage: 'en',
  detectionMode: 'system_only',
  ocrPanelPosition: 'top_right',
  clearInputOnTranslate: false,
  keepResultForSelection: true,
  autoSelectQueryTextOnOpen: false,
  autoQueryOnSelection: true,
  autoQueryOnOcr: true,
  autoQueryOnPaste: true,
  autoSpeakEnglishWord: false,
  englishVoice: 'us',
  autoCopyResult: false,
  httpApiEnabled: true,
  shortcuts: DEFAULT_SHORTCUTS,
  providers: {
    localOcr: { ...DEFAULT_TOOL_PROVIDERS.localOcr },
    youdao_web: { ...DEFAULT_TOOL_PROVIDERS.youdao_web },
    bing_web: { ...DEFAULT_TOOL_PROVIDERS.bing_web },
    deepl_free: { ...DEFAULT_TOOL_PROVIDERS.deepl_free },
    azure_translator: { ...DEFAULT_TOOL_PROVIDERS.azure_translator },
    google_translate: { ...DEFAULT_TOOL_PROVIDERS.google_translate },
    tencent_tmt: { ...DEFAULT_TOOL_PROVIDERS.tencent_tmt },
    baidu_fanyi: { ...DEFAULT_TOOL_PROVIDERS.baidu_fanyi },
  },
};
