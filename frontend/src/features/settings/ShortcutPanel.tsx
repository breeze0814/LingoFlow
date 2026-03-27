import { useEffect, useState } from 'react';
import { ShortcutConfig, ShortcutId } from './settingsTypes';
import { SHORTCUT_FIELDS } from './settingsTabs';
import { getShortcutEventKey } from './shortcutMatcher';

type ShortcutPanelProps = {
  shortcuts: ShortcutConfig;
  onChangeShortcut: (key: ShortcutId, value: string) => void;
};

const MODIFIER_ONLY_KEYS = new Set(['Meta', 'Control', 'Shift', 'Alt']);

const SPECIAL_KEY_LABELS: Record<string, string> = {
  ' ': 'Space',
  Escape: 'Esc',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
};

function formatShortcutKeyLabel(key: string): string {
  return SPECIAL_KEY_LABELS[key] ?? key;
}

function isEscapeWithoutModifier(event: KeyboardEvent): boolean {
  if (event.key !== 'Escape') {
    return false;
  }
  return !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
}

function getShortcutValue(event: KeyboardEvent): string | null {
  if (MODIFIER_ONLY_KEYS.has(event.key)) {
    return null;
  }

  const keyToken = getShortcutEventKey(event);
  const parts: string[] = [];
  if (event.metaKey) {
    parts.push('Cmd');
  }
  if (event.ctrlKey) {
    parts.push('Ctrl');
  }
  if (event.altKey) {
    parts.push('Option');
  }
  if (event.shiftKey) {
    parts.push('Shift');
  }
  parts.push(formatShortcutKeyLabel(keyToken));
  return parts.join(' + ');
}

function getPanelHint(recordingShortcutId: ShortcutId | null): string {
  if (recordingShortcutId) {
    return '正在监听按键，请直接按下组合键，按 Esc 取消。';
  }
  return '点击“修改”后按下快捷键组合，修改后会立即生效并自动保存。';
}

export function ShortcutPanel({ shortcuts, onChangeShortcut }: ShortcutPanelProps) {
  const [recordingShortcutId, setRecordingShortcutId] = useState<ShortcutId | null>(null);

  useEffect(() => {
    if (!recordingShortcutId) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEscapeWithoutModifier(event)) {
        event.preventDefault();
        setRecordingShortcutId(null);
        return;
      }

      const shortcutValue = getShortcutValue(event);
      if (!shortcutValue) {
        return;
      }

      event.preventDefault();
      onChangeShortcut(recordingShortcutId, shortcutValue);
      setRecordingShortcutId(null);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onChangeShortcut, recordingShortcutId]);

  return (
    <section
      className="settingsShortcutPanel"
      data-shortcut-recording={recordingShortcutId ? 'true' : 'false'}
    >
      <h3>系统快捷键</h3>
      <p className="settingsShortcutNote">{getPanelHint(recordingShortcutId)}</p>
      <div className="settingsShortcutForm">
        {SHORTCUT_FIELDS.map((item) => {
          const isRecording = recordingShortcutId === item.id;
          return (
            <div key={item.id} className="settingsShortcutField">
              <span className="settingsShortcutLabel">{item.action}</span>
              <div className="settingsShortcutBindingRow">
                <span
                  className={
                    isRecording
                      ? 'settingsShortcutValue settingsShortcutValueRecording'
                      : 'settingsShortcutValue'
                  }
                >
                  {isRecording ? '请按下快捷键...' : shortcuts[item.id]}
                </span>
                <button
                  type="button"
                  className={
                    isRecording
                      ? 'settingsShortcutEditButton settingsShortcutEditButtonActive'
                      : 'settingsShortcutEditButton'
                  }
                  aria-label={`修改${item.action}快捷键`}
                  onClick={() => setRecordingShortcutId(item.id)}
                >
                  {isRecording ? '监听中' : '修改'}
                </button>
              </div>
              <span className="settingsShortcutDescription">{item.description}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
