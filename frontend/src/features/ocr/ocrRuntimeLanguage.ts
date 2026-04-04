const DEFAULT_LANGUAGES = ['chi_sim', 'eng'] as const;

const LANGUAGE_HINT_TO_TESSERACT: Record<string, string[]> = {
  zh: ['chi_sim', 'eng'],
  'zh-cn': ['chi_sim', 'eng'],
  en: ['eng'],
  ja: ['jpn', 'eng'],
  ko: ['kor', 'eng'],
  fr: ['fra', 'eng'],
  de: ['deu', 'eng'],
};

function normalizeSourceLangHint(sourceLangHint?: string | null) {
  return sourceLangHint?.trim().toLowerCase() ?? '';
}

export function resolveTesseractLanguages(sourceLangHint?: string | null) {
  const normalized = normalizeSourceLangHint(sourceLangHint);
  return LANGUAGE_HINT_TO_TESSERACT[normalized] ?? [...DEFAULT_LANGUAGES];
}
