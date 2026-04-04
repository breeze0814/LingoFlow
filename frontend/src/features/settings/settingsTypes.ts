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

export type ToolProviderId = 'localOcr' | 'deepLTranslate';

export type ToolProviderConfig = {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type ToolProviderConfigMap = Record<ToolProviderId, ToolProviderConfig>;

export type ToolProviderDefinition = {
  id: ToolProviderId;
  name: string;
  group: 'no_api_key' | 'requires_api_key';
  logoText: string;
  category: 'OCR' | '翻译';
  description: string;
  requiresApiKey: boolean;
  supportsBaseUrl: boolean;
  supportsModel: boolean;
  apiKeyPlaceholder: string;
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
    logoText: 'OCR',
    category: 'OCR',
    description: '使用系统 OCR 引擎，无需 API Key。',
    requiresApiKey: false,
    supportsBaseUrl: false,
    supportsModel: false,
    apiKeyPlaceholder: '',
  },
  {
    id: 'deepLTranslate',
    name: 'DeepL 翻译',
    group: 'requires_api_key',
    logoText: 'DL',
    category: '翻译',
    description: '高质量文本翻译，建议配置专用 API Key。',
    requiresApiKey: true,
    supportsBaseUrl: true,
    supportsModel: false,
    apiKeyPlaceholder: 'deepl-...',
  },
];

export const DEFAULT_TOOL_PROVIDERS: ToolProviderConfigMap = {
  localOcr: {
    enabled: true,
    apiKey: '',
    baseUrl: '',
    model: '',
  },
  deepLTranslate: {
    enabled: false,
    apiKey: '',
    baseUrl: 'https://api-free.deepl.com/v2',
    model: '',
  },
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
    deepLTranslate: { ...DEFAULT_TOOL_PROVIDERS.deepLTranslate },
  },
};
