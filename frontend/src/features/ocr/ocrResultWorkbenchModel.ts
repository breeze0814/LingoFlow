import { providerLabel, providerMeta } from '../translator/providerMeta';
import { DisplayRow } from './ocrResultRows';
import { TranslationWorkspaceStatus } from './translationWorkspaceService';

export type CopyHandler = (content: string, successMessage: string) => void;

export type ProviderState = {
  color: string;
  label: string;
  providerId: string;
  row: DisplayRow | null;
  statusLabel: string;
};

export type ResultState = {
  featuredRow: DisplayRow | null;
  providerStates: ProviderState[];
  secondaryRows: DisplayRow[];
};

const PROVIDER_ORDER = [
  'deepl_free',
  'google_translate',
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

function featuredProviderId(rows: DisplayRow[], preferredProviderId: string | null): string | null {
  const preferredRow = rows.find((row) => row.providerId === preferredProviderId && !row.isError);
  if (preferredRow) {
    return preferredRow.providerId;
  }
  return rows.find((row) => !row.isError)?.providerId ?? preferredProviderId;
}

function providerStatusLabel(
  row: DisplayRow | null,
  featuredId: string | null,
  providerId: string,
): string {
  if (featuredId === providerId) {
    return '主结果';
  }
  if (!row) {
    return '等待中';
  }
  return row.isError ? '失败' : '已返回';
}

export function providerMark(providerId: string): string {
  return providerLabel(providerId).slice(0, 2).toUpperCase();
}

export function buildResultState(
  rows: DisplayRow[],
  preferredProviderId: string | null,
): ResultState {
  const rowMap = new Map(rows.map((row) => [row.providerId, row] as const));
  const featuredId = featuredProviderId(rows, preferredProviderId);
  return {
    featuredRow: featuredId ? (rowMap.get(featuredId) ?? null) : null,
    providerStates: PROVIDER_ORDER.map((providerId) => {
      const row = rowMap.get(providerId) ?? null;
      return {
        color: providerMeta(providerId).color,
        label: providerLabel(providerId),
        providerId,
        row,
        statusLabel: providerStatusLabel(row, featuredId, providerId),
      };
    }),
    secondaryRows: rows.filter((row) => row.providerId !== featuredId),
  };
}
