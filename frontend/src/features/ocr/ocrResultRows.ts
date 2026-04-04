import { ProviderTranslationResult, TaskResult } from '../task/taskTypes';

export type DisplayRow = {
  providerId: string;
  content: string;
  isError: boolean;
};

const PROVIDER_PRIORITY = [
  'deepl_free',
  'google_translate',
  'openai_compatible',
  'azure_translator',
  'tencent_tmt',
  'baidu_fanyi',
  'youdao_web',
] as const;

const providerPriorityMap = new Map<string, number>(
  PROVIDER_PRIORITY.map((providerId, index) => [providerId, index] as const),
);

export function normalizeDisplayText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\t/g, '  ').trim();
}

function providerPriority(providerId: string): number {
  return providerPriorityMap.get(providerId) ?? PROVIDER_PRIORITY.length;
}

function compareProviderResults(
  left: ProviderTranslationResult,
  right: ProviderTranslationResult,
): number {
  const priorityDiff = providerPriority(left.providerId) - providerPriority(right.providerId);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }
  return left.providerId.localeCompare(right.providerId);
}

export function buildDisplayRows(result: TaskResult | null): DisplayRow[] {
  if (!result) {
    return [];
  }
  if (result.translationResults && result.translationResults.length > 0) {
    return [...result.translationResults].sort(compareProviderResults).map((item) => {
      if (item.error) {
        return {
          providerId: item.providerId,
          content: `${item.error.message} (${item.error.code})`,
          isError: true,
        };
      }

      return {
        providerId: item.providerId,
        content: normalizeDisplayText(item.translatedText ?? 'Provider 未返回译文'),
        isError: false,
      };
    });
  }

  if (!result.translatedText) {
    return [];
  }

  return [
    {
      providerId: result.providerId,
      content: normalizeDisplayText(result.translatedText),
      isError: false,
    },
  ];
}
