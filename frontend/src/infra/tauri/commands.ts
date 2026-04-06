import { invoke } from '@tauri-apps/api/core';

type TranslateInput = {
  text: string;
  sourceLang?: string;
  targetLang: string;
  translateProviderConfigs?: {
    id: string;
    apiKey?: string;
    baseUrl?: string;
    region?: string;
    secretId?: string;
    secretKey?: string;
    appId?: string;
    appSecret?: string;
  }[];
};

type SelectionInput = {
  targetLang: string;
  translateProviderConfigs?: TranslateInput['translateProviderConfigs'];
};

type OcrRecognizeInput = {
  sourceLangHint?: string;
};

type OcrTranslateInput = {
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
  sourceLangHint?: string;
};

type OcrTranslateRegionInput = {
  captureRect: CaptureRect;
  sourceLang?: string;
  targetLang: string;
  sourceLangHint?: string;
  translateProviderConfigs?: TranslateInput['translateProviderConfigs'];
};

type DebugPrintInput = {
  message: string;
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

export const commandsClient = {
  inputTranslate(input: TranslateInput): Promise<CommandTaskResponse> {
    return invoke('input_translate', {
      payload: {
        text: input.text,
        source_lang: input.sourceLang,
        target_lang: input.targetLang,
        translate_provider_configs: input.translateProviderConfigs?.map((item) => ({
          id: item.id,
          api_key: item.apiKey,
          base_url: item.baseUrl,
          region: item.region,
          secret_id: item.secretId,
          secret_key: item.secretKey,
          app_id: item.appId,
          app_secret: item.appSecret,
        })),
      },
    });
  },
  selectionTranslate(input: SelectionInput): Promise<CommandTaskResponse> {
    return invoke('selection_translate', {
      payload: {
        target_lang: input.targetLang,
        translate_provider_configs: input.translateProviderConfigs?.map((item) => ({
          id: item.id,
          api_key: item.apiKey,
          base_url: item.baseUrl,
          region: item.region,
          secret_id: item.secretId,
          secret_key: item.secretKey,
          app_id: item.appId,
          app_secret: item.appSecret,
        })),
      },
    });
  },
  ocrRecognize(input: OcrRecognizeInput): Promise<CommandTaskResponse> {
    return invoke('ocr_recognize', {
      payload: {
        source_lang_hint: input.sourceLangHint,
      },
    });
  },
  ocrRecognizeRegion(input: OcrRecognizeRegionInput): Promise<CommandTaskResponse> {
    return invoke('ocr_recognize_region', {
      payload: {
        capture_rect: input.captureRect,
        source_lang_hint: input.sourceLangHint,
      },
    });
  },
  ocrTranslate(input: OcrTranslateInput): Promise<CommandTaskResponse> {
    return invoke('ocr_translate', {
      payload: {
        source_lang: input.sourceLang,
        target_lang: input.targetLang,
        source_lang_hint: input.sourceLangHint,
        translate_provider_configs: input.translateProviderConfigs?.map((item) => ({
          id: item.id,
          api_key: item.apiKey,
          base_url: item.baseUrl,
          region: item.region,
          secret_id: item.secretId,
          secret_key: item.secretKey,
          app_id: item.appId,
          app_secret: item.appSecret,
        })),
      },
    });
  },
  ocrTranslateRegion(input: OcrTranslateRegionInput): Promise<CommandTaskResponse> {
    return invoke('ocr_translate_region', {
      payload: {
        capture_rect: input.captureRect,
        source_lang: input.sourceLang,
        target_lang: input.targetLang,
        source_lang_hint: input.sourceLangHint,
        translate_provider_configs: input.translateProviderConfigs?.map((item) => ({
          id: item.id,
          api_key: item.apiKey,
          base_url: item.baseUrl,
          region: item.region,
          secret_id: item.secretId,
          secret_key: item.secretKey,
          app_id: item.appId,
          app_secret: item.appSecret,
        })),
      },
    });
  },
  debugPrint(input: DebugPrintInput): Promise<void> {
    return invoke('debug_print', input);
  },
};
