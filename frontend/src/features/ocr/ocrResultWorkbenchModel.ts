import { providerLabel, providerMeta } from '../translator/providerMeta';
import { DisplayRow } from './ocrResultRows';
import { TranslationWorkspaceStatus } from './translationWorkspaceService';

export type CopyHandler = (content: string, successMessage: string) => void;

export type ProviderState = {
  color: string;
  content: string;
  hasResult: boolean;
  icon: string;
  isError: boolean;
  isPinned: boolean;
  label: string;
  providerId: string;
  rankLabel: string;
  statusLabel: string;
};

export type ResultState = {
  orderedRows: ProviderState[];
};

const PROVIDER_ORDER = [
  'deepl_free',
  'google_translate',
  'bing_web',
  'openai_compatible',
  'azure_translator',
  'tencent_tmt',
  'baidu_fanyi',
  'youdao_web',
] as const;

export function statusLabel(status: TranslationWorkspaceStatus): string {
  if (status === 'pending') {
    return '翻译中';
  }
  if (status === 'success') {
    return '已完成';
  }
  if (status === 'failure') {
    return '失败';
  }
  return '待输入';
}

function pinnedProviderId(rows: DisplayRow[], preferredProviderId: string | null): string | null {
  const preferredRow = rows.find((row) => row.providerId === preferredProviderId);
  if (preferredRow) {
    return preferredRow.providerId;
  }
  return rows.find((row) => !row.isError)?.providerId ?? preferredProviderId;
}

function providerStatusLabel(row: DisplayRow, isPinned: boolean): string {
  if (isPinned) {
    return '置顶结果';
  }
  return row.isError ? '失败' : '已返回';
}

function rankLabel(index: number, isPinned: boolean): string {
  if (isPinned) {
    return 'Pinned';
  }
  return String(index + 1).padStart(2, '0');
}

function compareRows(left: DisplayRow, right: DisplayRow): number {
  const leftIndex = PROVIDER_ORDER.indexOf(left.providerId as (typeof PROVIDER_ORDER)[number]);
  const rightIndex = PROVIDER_ORDER.indexOf(right.providerId as (typeof PROVIDER_ORDER)[number]);
  if (leftIndex >= 0 && rightIndex >= 0) {
    return leftIndex - rightIndex;
  }
  if (leftIndex >= 0) {
    return -1;
  }
  if (rightIndex >= 0) {
    return 1;
  }
  return left.providerId.localeCompare(right.providerId);
}

/**
 * Builds the result state for the OCR workbench, organizing provider results into a sorted,
 * pinned display order with status labels and metadata.
 *
 * This function:
 * 1. Merges actual results with enabled providers (to show "waiting" states)
 * 2. Determines which provider should be pinned (preferred or first successful)
 * 3. Sorts providers with pinned provider first, then by predefined priority order
 * 4. Enriches each row with display metadata (color, icon, status label)
 *
 * The pinning logic prioritizes:
 * - User's preferred provider (if it has results)
 * - First non-error provider (if preferred has no results)
 * - Preferred provider ID (as fallback)
 *
 * @param rows - Array of display rows with provider results
 * @param preferredProviderId - User's preferred provider ID (or null)
 * @param enabledProviderIds - List of enabled provider IDs to show
 * @returns Result state with ordered provider rows ready for display
 *
 * @example
 * ```ts
 * const rows = [
 *   { providerId: 'deepl_free', content: 'Hello', isError: false },
 *   { providerId: 'google_translate', content: 'Error', isError: true }
 * ];
 * const state = buildResultState(rows, 'deepl_free', ['deepl_free', 'google_translate']);
 * // Returns: { orderedRows: [deepl_free (pinned), google_translate] }
 * ```
 */
export function buildResultState(
  rows: DisplayRow[],
  preferredProviderId: string | null,
  enabledProviderIds: string[],
): ResultState {
  const rowMap = new Map(rows.map((row) => [row.providerId, row] as const));
  const completeRows = Array.from(
    new Set([...enabledProviderIds, ...rows.map((row) => row.providerId)]),
  )
    .map(
      (providerId) =>
        rowMap.get(providerId) ?? { providerId, content: '等待翻译...', isError: false },
    )
    .sort(compareRows);
  const pinnedId = pinnedProviderId(completeRows, preferredProviderId);
  return {
    orderedRows: completeRows
      .sort((left, right) => {
        if (left.providerId === pinnedId) {
          return -1;
        }
        if (right.providerId === pinnedId) {
          return 1;
        }
        return compareRows(left, right);
      })
      .map((row, index) => {
        const meta = providerMeta(row.providerId);
        const isPinned = row.providerId === pinnedId;
        const hasResult = rowMap.has(row.providerId);
        return {
          color: meta.color,
          content: row.content,
          hasResult,
          icon: meta.icon,
          isError: row.isError,
          isPinned,
          label: providerLabel(row.providerId),
          providerId: row.providerId,
          rankLabel: rankLabel(index, isPinned),
          statusLabel: hasResult ? providerStatusLabel(row, isPinned) : '等待中',
        };
      }),
  };
}
