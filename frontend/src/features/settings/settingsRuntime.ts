import { TaskResult } from '../task/taskTypes';
import { EnglishVoice, SettingsState } from './settingsTypes';

const ENGLISH_WORD_PATTERN = /^[A-Za-z]+(?:[-'][A-Za-z]+)*$/;

type SourceLanguageSettings = Pick<SettingsState, 'detectionMode' | 'primaryLanguage'>;

function normalizeNonEmptyText(text: string | undefined): string | null {
  if (!text) {
    return null;
  }
  const normalized = text.trim();
  return normalized ? normalized : null;
}

function firstSuccessfulTranslation(result: TaskResult): string | null {
  return (
    result.translationResults
      ?.filter((item) => !item.error)
      .map((item) => normalizeNonEmptyText(item.translatedText))
      .find((item): item is string => item !== null) ?? null
  );
}

export function resolveConfiguredSourceLanguage(
  selectedSourceLanguage: string,
  settings: SourceLanguageSettings,
): string {
  if (settings.detectionMode === 'system_only') {
    return selectedSourceLanguage;
  }
  if (selectedSourceLanguage !== settings.primaryLanguage) {
    return selectedSourceLanguage;
  }
  return 'auto';
}

export function selectPrimaryTranslatedText(
  result: TaskResult,
  preferredProviderId: string | null,
): string | null {
  const preferredText =
    result.translationResults?.find(
      (item) => item.providerId === preferredProviderId && !item.error,
    )?.translatedText ?? null;
  const normalizedPreferred = normalizeNonEmptyText(preferredText ?? undefined);
  if (normalizedPreferred) {
    return normalizedPreferred;
  }
  return normalizeNonEmptyText(result.translatedText) ?? firstSuccessfulTranslation(result);
}

export function englishVoiceLocale(voice: EnglishVoice): string {
  if (voice === 'uk') {
    return 'en-GB';
  }
  return 'en-US';
}

export function selectSpokenEnglishWord(result: TaskResult): string | null {
  const sourceText = normalizeNonEmptyText(result.sourceText);
  if (!sourceText || !ENGLISH_WORD_PATTERN.test(sourceText)) {
    return null;
  }
  if (!selectPrimaryTranslatedText(result, null)) {
    return null;
  }
  return sourceText;
}
