type ShortcutPattern = {
  key: string;
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  metaOrCtrl: boolean;
};

type ModifierKey = 'meta' | 'ctrl' | 'alt' | 'shift';

const MODIFIER_ALIAS: Record<string, ModifierKey> = {
  cmd: 'meta',
  command: 'meta',
  meta: 'meta',
  ctrl: 'ctrl',
  control: 'ctrl',
  option: 'alt',
  opt: 'alt',
  alt: 'alt',
  shift: 'shift',
};

const SPECIAL_KEY_ALIAS: Record<string, string> = {
  esc: 'Escape',
  escape: 'Escape',
  space: ' ',
  enter: 'Enter',
  tab: 'Tab',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

const CODE_KEY_ALIAS: Record<string, string> = {
  Space: ' ',
  Escape: 'Escape',
  Enter: 'Enter',
  Tab: 'Tab',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
};

function normalizeKeyToken(token: string): string {
  const normalized = token.trim().toLowerCase();
  if (SPECIAL_KEY_ALIAS[normalized]) {
    return SPECIAL_KEY_ALIAS[normalized];
  }
  if (token.length === 1) {
    return token.toUpperCase();
  }
  return token;
}

function normalizeKeyboardEventKey(key: string): string {
  if (key === ' ') {
    return ' ';
  }
  if (key.length === 1) {
    return key.toUpperCase();
  }
  return key;
}

function keyFromEventCode(code: string): string | null {
  if (code.startsWith('Key') && code.length === 4) {
    return code.slice(3).toUpperCase();
  }
  if (code.startsWith('Digit') && code.length === 6) {
    return code.slice(5);
  }
  return CODE_KEY_ALIAS[code] ?? null;
}

export function getShortcutEventKey(event: KeyboardEvent): string {
  const codeKey = keyFromEventCode(event.code);
  if (codeKey) {
    return codeKey;
  }
  return normalizeKeyboardEventKey(event.key);
}

export function parseShortcutPattern(shortcut: string): ShortcutPattern | null {
  const parts = shortcut
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const pattern: ShortcutPattern = {
    key: '',
    meta: false,
    ctrl: false,
    alt: false,
    shift: false,
    metaOrCtrl: false,
  };

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'cmd/ctrl' || lower === 'cmdorctrl' || lower === 'commandorcontrol') {
      pattern.metaOrCtrl = true;
      continue;
    }
    const modifier = MODIFIER_ALIAS[lower];
    if (modifier) {
      pattern[modifier] = true;
      continue;
    }
    if (pattern.key) {
      return null;
    }
    pattern.key = normalizeKeyToken(part);
  }

  if (!pattern.key) {
    return null;
  }
  return pattern;
}

function matchModifiers(event: KeyboardEvent, pattern: ShortcutPattern): boolean {
  if (event.altKey !== pattern.alt) {
    return false;
  }
  if (event.shiftKey !== pattern.shift) {
    return false;
  }

  if (pattern.metaOrCtrl) {
    if (!event.metaKey && !event.ctrlKey) {
      return false;
    }
    if (pattern.meta && !event.metaKey) {
      return false;
    }
    if (pattern.ctrl && !event.ctrlKey) {
      return false;
    }
    return true;
  }

  return event.metaKey === pattern.meta && event.ctrlKey === pattern.ctrl;
}

export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const pattern = parseShortcutPattern(shortcut);
  if (!pattern) {
    return false;
  }
  if (!matchModifiers(event, pattern)) {
    return false;
  }
  return getShortcutEventKey(event) === pattern.key;
}
