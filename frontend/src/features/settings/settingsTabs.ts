import { ShortcutId } from './settingsTypes';

export type SettingsTabId = 'tool' | 'general' | 'service' | 'shortcut';

type SettingsTab = {
  id: SettingsTabId;
  label: string;
  iconPath: string;
};

type ShortcutField = {
  id: ShortcutId;
  action: string;
  description: string;
};

export const SHORTCUT_FIELDS: ShortcutField[] = [
  {
    id: 'inputTranslate',
    action: '输入翻译',
    description: '打开输入框并提交翻译',
  },
  {
    id: 'ocrTranslate',
    action: '截图翻译',
    description: '截图后直接翻译文字内容',
  },
  {
    id: 'selectionTranslate',
    action: '划词翻译',
    description: '对当前选中文本执行翻译',
  },
  {
    id: 'ocrRecognize',
    action: '静默截图 OCR',
    description: '仅提取文字，不执行翻译',
  },
  {
    id: 'showMainWindow',
    action: '显示迷你窗口',
    description: '唤起设置窗口',
  },
  {
    id: 'openSettings',
    action: '打开设置',
    description: '从系统菜单直接打开设置页',
  },
] as const;

export const SETTINGS_TAB_ITEMS: SettingsTab[] = [
  {
    id: 'tool',
    label: '工具',
    iconPath:
      'M20.5 6.5 17.5 3.5a1.7 1.7 0 0 0-2.4 0l-2 2-2.6-2.6a1.7 1.7 0 0 0-2.4 0L6.5 4.5a1.7 1.7 0 0 0 0 2.4L9 9.4l-6.1 6.1a1.7 1.7 0 0 0 0 2.4l1.2 1.2a1.7 1.7 0 0 0 2.4 0L12.6 13l2.5 2.5a1.7 1.7 0 0 0 2.4 0l3-3a1.7 1.7 0 0 0 0-2.4L18 7.7l2.5-2.5a1.7 1.7 0 0 0 0-2.4Z',
  },
  {
    id: 'general',
    label: '通用',
    iconPath:
      'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm0 4.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm0 9a1 1 0 0 1-1-1v-2.5a1 1 0 1 1 2 0V15a1 1 0 0 1-1 1Z',
  },
  {
    id: 'service',
    label: '服务',
    iconPath:
      'M4 9.5A2.5 2.5 0 0 1 6.5 7h11A2.5 2.5 0 0 1 20 9.5V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9.5Zm4-5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6H8V4.5Z',
  },
  {
    id: 'shortcut',
    label: '快捷键',
    iconPath:
      'M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Zm1 3v2h2V7H8Zm3 0v2h2V7h-2Zm3 0v2h2V7h-2ZM8 11v2h8v-2H8Zm0 4v2h5v-2H8Z',
  },
];
