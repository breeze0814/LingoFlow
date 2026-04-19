import { invoke } from '@tauri-apps/api/core';
import { PermissionStatus } from '../../features/settings/permissionStatus';
import { SettingsState } from '../../features/settings/settingsTypes';

type TranslateProviderConfig = {
  id: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  region?: string;
  secretId?: string;
  secretKey?: string;
  appId?: string;
  appSecret?: string;
};

type OcrProviderConfig = {
  id: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

/**
 * Maps a translate provider config from camelCase to snake_case for Rust backend.
 * @param config - The translate provider configuration
 * @returns The mapped configuration with snake_case keys
 */
function mapTranslateProviderConfig(config: TranslateProviderConfig) {
  return {
    id: config.id,
    api_key: config.apiKey,
    base_url: config.baseUrl,
    model: config.model,
    region: config.region,
    secret_id: config.secretId,
    secret_key: config.secretKey,
    app_id: config.appId,
    app_secret: config.appSecret,
  };
}

/**
 * Maps an OCR provider config from camelCase to snake_case for Rust backend.
 * @param config - The OCR provider configuration
 * @returns The mapped configuration with snake_case keys
 */
function mapOcrProviderConfig(config: OcrProviderConfig) {
  return {
    id: config.id,
    api_key: config.apiKey,
    base_url: config.baseUrl,
    model: config.model,
  };
}

type TranslateInput = {
  text: string;
  sourceLang?: string;
  targetLang: string;
  translateProviderConfigs?: TranslateProviderConfig[];
};

type SelectionInput = {
  targetLang: string;
  translateProviderConfigs?: TranslateInput['translateProviderConfigs'];
};

type OcrRecognizeInput = {
  ocrProviderConfigs?: OcrProviderConfig[];
  ocrProviderId?: string;
  sourceLangHint?: string;
};

type OcrTranslateInput = {
  ocrProviderConfigs?: OcrRecognizeInput['ocrProviderConfigs'];
  ocrProviderId?: string;
  sourceLang?: string;
  targetLang: string;
  sourceLangHint?: string;
  translateProviderConfigs?: TranslateInput['translateProviderConfigs'];
};

type CaptureRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type OcrRecognizeRegionInput = {
  captureRect: CaptureRect;
  ocrProviderConfigs?: OcrRecognizeInput['ocrProviderConfigs'];
  ocrProviderId?: string;
  sourceLangHint?: string;
};

type OcrTranslateRegionInput = {
  captureRect: CaptureRect;
  ocrProviderConfigs?: OcrRecognizeInput['ocrProviderConfigs'];
  ocrProviderId?: string;
  sourceLang?: string;
  targetLang: string;
  sourceLangHint?: string;
  translateProviderConfigs?: TranslateInput['translateProviderConfigs'];
};

type DebugPrintInput = {
  message: string;
};

type RuntimeSettingsInput = {
  httpApiEnabled: boolean;
  httpApiPort: number;
  sourceLang: string;
  targetLang: string;
};

type CommandError = {
  code: string;
  message: string;
  retryable: boolean;
};

type CommandTaskData = {
  provider_id: string;
  source_text: string;
  translated_text?: string;
  recognized_text?: string;
  translation_results?: {
    provider_id: string;
    translated_text?: string;
    error?: CommandError | null;
  }[];
};

type CommandTaskResponse = {
  ok: boolean;
  task_id: string;
  status: 'success' | 'failure' | 'cancelled' | 'accepted';
  data?: CommandTaskData | null;
  error?: CommandError | null;
};

type RuntimeSettingsResponse = {
  http_api_enabled: boolean;
  http_api_running: boolean;
};

type SelectionTextResponse = {
  selected_text: string;
};

export const commandsClient = {
  inputTranslate(input: TranslateInput): Promise<CommandTaskResponse> {
    return invoke('input_translate', {
      payload: {
        text: input.text,
        source_lang: input.sourceLang,
        target_lang: input.targetLang,
        translate_provider_configs: input.translateProviderConfigs?.map(mapTranslateProviderConfig),
      },
    });
  },
  selectionTranslate(input: SelectionInput): Promise<CommandTaskResponse> {
    return invoke('selection_translate', {
      payload: {
        target_lang: input.targetLang,
        translate_provider_configs: input.translateProviderConfigs?.map(mapTranslateProviderConfig),
      },
    });
  },
  readSelectionText(): Promise<{ selectedText: string }> {
    return invoke<SelectionTextResponse>('read_selection_text').then((response) => ({
      selectedText: response.selected_text,
    }));
  },
  ocrRecognize(input: OcrRecognizeInput): Promise<CommandTaskResponse> {
    return invoke('ocr_recognize', {
      payload: {
        ocr_provider_id: input.ocrProviderId,
        ocr_provider_configs: input.ocrProviderConfigs?.map(mapOcrProviderConfig),
        source_lang_hint: input.sourceLangHint,
      },
    });
  },
  ocrRecognizeRegion(input: OcrRecognizeRegionInput): Promise<CommandTaskResponse> {
    return invoke('ocr_recognize_region', {
      payload: {
        capture_rect: input.captureRect,
        ocr_provider_id: input.ocrProviderId,
        ocr_provider_configs: input.ocrProviderConfigs?.map(mapOcrProviderConfig),
        source_lang_hint: input.sourceLangHint,
      },
    });
  },
  ocrTranslate(input: OcrTranslateInput): Promise<CommandTaskResponse> {
    return invoke('ocr_translate', {
      payload: {
        ocr_provider_id: input.ocrProviderId,
        ocr_provider_configs: input.ocrProviderConfigs?.map(mapOcrProviderConfig),
        source_lang: input.sourceLang,
        target_lang: input.targetLang,
        source_lang_hint: input.sourceLangHint,
        translate_provider_configs: input.translateProviderConfigs?.map(mapTranslateProviderConfig),
      },
    });
  },
  ocrTranslateRegion(input: OcrTranslateRegionInput): Promise<CommandTaskResponse> {
    return invoke('ocr_translate_region', {
      payload: {
        capture_rect: input.captureRect,
        ocr_provider_id: input.ocrProviderId,
        ocr_provider_configs: input.ocrProviderConfigs?.map(mapOcrProviderConfig),
        source_lang: input.sourceLang,
        target_lang: input.targetLang,
        source_lang_hint: input.sourceLangHint,
        translate_provider_configs: input.translateProviderConfigs?.map(mapTranslateProviderConfig),
      },
    });
  },
  debugPrint(input: DebugPrintInput): Promise<void> {
    return invoke('debug_print', input);
  },
  syncRuntimeSettings(input: RuntimeSettingsInput): Promise<RuntimeSettingsResponse> {
    return invoke('sync_runtime_settings', {
      payload: {
        http_api_enabled: input.httpApiEnabled,
        http_api_port: input.httpApiPort,
        source_lang: input.sourceLang,
        target_lang: input.targetLang,
      },
    });
  },
  getPermissionStatus(): Promise<PermissionStatus> {
    return invoke('get_permission_status');
  },
  loadSettings(): Promise<SettingsState | null> {
    return invoke('load_settings');
  },
  saveSettings(settings: SettingsState): Promise<void> {
    return invoke('save_settings', {
      payload: settings,
    });
  },
};
