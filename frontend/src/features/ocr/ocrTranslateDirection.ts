const LATIN_LETTER_PATTERN = /[A-Za-z]/;
const JAPANESE_OR_KOREAN_PATTERN = /[\u3040-\u30ff\uac00-\ud7af]/;
const HAN_CHARACTER_PATTERN = /\p{Script=Han}/gu;

function hanCharacterCount(text: string) {
  return text.match(HAN_CHARACTER_PATTERN)?.length ?? 0;
}

function compactText(text: string) {
  return text.replace(/\s+/g, '');
}

function isLikelyChineseText(text: string) {
  const compact = compactText(text);
  if (!compact) {
    return false;
  }
  if (LATIN_LETTER_PATTERN.test(compact) || JAPANESE_OR_KOREAN_PATTERN.test(compact)) {
    return false;
  }

  const hanCount = hanCharacterCount(compact);
  return hanCount > 0 && hanCount / compact.length >= 0.3;
}

export type OcrTranslateDirection = {
  sourceLanguageLabel: string;
  targetLanguageCode: 'zh-CN' | 'en';
  targetLanguageLabel: string;
};

export function resolveOcrTranslateDirection(text: string): OcrTranslateDirection {
  if (isLikelyChineseText(text)) {
    return {
      sourceLanguageLabel: '简体中文',
      targetLanguageCode: 'en',
      targetLanguageLabel: '英语',
    };
  }

  return {
    sourceLanguageLabel: '自动识别',
    targetLanguageCode: 'zh-CN',
    targetLanguageLabel: '简体中文',
  };
}
