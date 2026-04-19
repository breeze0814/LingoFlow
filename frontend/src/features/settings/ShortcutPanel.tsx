import { memo, useCallback, useEffect, useState } from 'react';
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

function getShortcutTokens(shortcut: string): string[] {
  return shortcut
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export const ShortcutPanel = memo(function ShortcutPanel({
  shortcuts,
  onChangeShortcut,
}: ShortcutPanelProps) {
  const [recordingShortcutId, setRecordingShortcutId] = useState<ShortcutId | null>(null);

  const handleStartRecording = useCallback((shortcutId: ShortcutId) => {
    setRecordingShortcutId(shortcutId);
  }, []);

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
      <div className="settingsShortcutList">
        {SHORTCUT_FIELDS.map((item) => {
          const isRecording = recordingShortcutId === item.id;
          const bindingLabel = isRecording
            ? `${item.action} 快捷键录制中，按下新的组合键，Esc 取消`
            : `${item.action} 当前快捷键：${shortcuts[item.id]}`;
          return (
            <article
              key={item.id}
              className={
                isRecording
                  ? 'settingsShortcutRow settingsShortcutRowRecording'
                  : 'settingsShortcutRow'
              }
            >
              <div className="settingsShortcutTextBlock">
                <span className="settingsShortcutLabel">{item.action}</span>
                <span className="settingsShortcutMeta">{item.description}</span>
              </div>
              <div className="settingsShortcutBinding" aria-label={bindingLabel}>
                {isRecording ? (
                  <span className="settingsShortcutListening">按下新的组合键，Esc 取消</span>
                ) : (
                  getShortcutTokens(shortcuts[item.id]).map((token) => (
                    <span key={`${item.id}-${token}`} className="settingsShortcutKeycap">
                      {token}
                    </span>
                  ))
                )}
              </div>
              <button
                type="button"
                className={
                  isRecording
                    ? 'settingsShortcutButton settingsShortcutButtonActive'
                    : 'settingsShortcutButton'
                }
                aria-label={`修改${item.action}快捷键`}
                onClick={() => handleStartRecording(item.id)}
              >
                {isRecording ? '监听中' : '修改'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
});
