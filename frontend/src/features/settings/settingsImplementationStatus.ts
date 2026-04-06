import { SettingsState } from './settingsTypes';

export type SettingsFieldKey = Exclude<keyof SettingsState, 'providers' | 'shortcuts'>;

export type SettingImplementationStatus = Readonly<{
  badge: '未实现';
  hint: string;
}>;

const NOT_IMPLEMENTED_STATUS: SettingImplementationStatus = Object.freeze({
  badge: '未实现',
  hint: '当前仅保存本地配置，尚未接入实际运行逻辑。',
});

const NOT_IMPLEMENTED_SETTING_KEYS: ReadonlySet<SettingsFieldKey> = new Set([
  'detectionMode',
  'clearInputOnTranslate',
  'autoSelectQueryTextOnOpen',
  'keepResultForSelection',
  'autoQueryOnSelection',
  'autoQueryOnOcr',
  'ocrPanelPosition',
  'autoQueryOnPaste',
  'autoSpeakEnglishWord',
  'englishVoice',
  'autoCopyResult',
  'httpApiEnabled',
]);

export function getSettingImplementationStatus(
  key: SettingsFieldKey,
): SettingImplementationStatus | null {
  if (!NOT_IMPLEMENTED_SETTING_KEYS.has(key)) {
    return null;
  }
  return NOT_IMPLEMENTED_STATUS;
}
