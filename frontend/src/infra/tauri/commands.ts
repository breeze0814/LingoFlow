import { invoke } from '@tauri-apps/api/core';

type TranslateInput = {
  text: string;
  sourceLang?: string;
  targetLang: string;
};

type SelectionInput = {
  targetLang: string;
};

type OcrRecognizeInput = {
  sourceLangHint?: string;
};

type OcrTranslateInput = {
  targetLang: string;
  sourceLangHint?: string;
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
      },
    });
  },
  selectionTranslate(input: SelectionInput): Promise<CommandTaskResponse> {
    return invoke('selection_translate', {
      payload: {
        target_lang: input.targetLang,
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
  ocrTranslate(input: OcrTranslateInput): Promise<CommandTaskResponse> {
    return invoke('ocr_translate', {
      payload: {
        target_lang: input.targetLang,
        source_lang_hint: input.sourceLangHint,
      },
    });
  },
  debugPrint(input: DebugPrintInput): Promise<void> {
    return invoke('debug_print', input);
  },
};
