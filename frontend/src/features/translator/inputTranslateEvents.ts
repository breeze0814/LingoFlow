export const OPEN_INPUT_TRANSLATE_EVENT = 'workspace://input_translate/open';

export type OpenInputTranslatePayload = {
  text?: string;
  sourceLang?: string;
  targetLang?: string;
};

export function isOpenInputTranslatePayload(value: unknown): value is OpenInputTranslatePayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const maybePayload = value as Record<string, unknown>;
  return (
    (maybePayload.text === undefined || typeof maybePayload.text === 'string') &&
    (maybePayload.sourceLang === undefined || typeof maybePayload.sourceLang === 'string') &&
    (maybePayload.targetLang === undefined || typeof maybePayload.targetLang === 'string')
  );
}
