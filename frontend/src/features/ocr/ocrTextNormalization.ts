const MAX_PARAGRAPH_BREAKS = 2;
const DELETE_CODE = 0x7f;
const MAX_C0_CONTROL_CODE = 0x1f;
const MIN_C0_CONTROL_CODE = 0x00;
const TAB_CODE = 0x09;
const LF_CODE = 0x0a;
const CR_CODE = 0x0d;
const ZERO_WIDTH_CODES = new Set([0x200b, 0x200c, 0x200d, 0x2060, 0xfeff]);

const MATCHING_CLOSERS = new Map<string, string>([
  ['"', '"'],
  ["'", "'"],
  ['`', '`'],
  ['“', '”'],
  ['‘', '’'],
  ['«', '»'],
  ['‹', '›'],
  ['「', '」'],
  ['『', '』'],
  ['《', '》'],
  ['〈', '〉'],
  ['（', '）'],
  ['(', ')'],
  ['[', ']'],
  ['【', '】'],
  ['{', '}'],
]);

const MATCHING_OPENERS = new Map<string, string>(
  Array.from(MATCHING_CLOSERS.entries()).map(([open, close]) => [close, open]),
);

const OPENING_NOISE = new Set([
  ...MATCHING_CLOSERS.keys(),
  '|',
  '¦',
  '•',
  '·',
  '●',
  '▪',
  '■',
  '◆',
  '※',
  '*',
  '#',
  '=',
  '~',
  '^',
]);

const CLOSING_NOISE = new Set([
  ...MATCHING_OPENERS.keys(),
  '|',
  '¦',
  '•',
  '·',
  '●',
  '▪',
  '■',
  '◆',
  '※',
  '*',
  '#',
  '=',
  '~',
  '^',
]);

function removeIgnoredCharacters(text: string) {
  return Array.from(text)
    .filter((char) => !isIgnoredCharacter(char))
    .join('');
}

function isIgnoredCharacter(char: string) {
  const code = char.codePointAt(0);
  if (code === undefined) {
    return false;
  }
  if (code === DELETE_CODE) {
    return true;
  }
  if (
    code >= MIN_C0_CONTROL_CODE &&
    code <= MAX_C0_CONTROL_CODE &&
    code !== TAB_CODE &&
    code !== LF_CODE &&
    code !== CR_CODE
  ) {
    return true;
  }
  return ZERO_WIDTH_CODES.has(code);
}

function normalizeLine(line: string) {
  const collapsed = removeIgnoredCharacters(line)
    .replace(/[^\S\r\n]+/g, ' ')
    .trim();
  return trimEdgeNoise(collapsed);
}

function firstChar(text: string) {
  return Array.from(text)[0] ?? '';
}

function lastChar(text: string) {
  const chars = Array.from(text);
  return chars[chars.length - 1] ?? '';
}

function trimFirstChar(text: string) {
  return Array.from(text).slice(1).join('').trimStart();
}

function trimLastChar(text: string) {
  const chars = Array.from(text);
  chars.pop();
  return chars.join('').trimEnd();
}

function shouldStripStart(first: string, last: string) {
  if (!first) {
    return false;
  }
  if (MATCHING_CLOSERS.get(first) === last) {
    return false;
  }
  return OPENING_NOISE.has(first) || CLOSING_NOISE.has(first);
}

function shouldStripEnd(first: string, last: string) {
  if (!last) {
    return false;
  }
  if (MATCHING_OPENERS.get(last) === first) {
    return false;
  }
  return OPENING_NOISE.has(last) || CLOSING_NOISE.has(last);
}

function trimEdgeNoise(line: string) {
  let current = line.trim();
  for (;;) {
    const start = firstChar(current);
    const end = lastChar(current);
    let next = current;

    if (shouldStripStart(start, end)) {
      next = trimFirstChar(next);
    }

    const nextStart = firstChar(next);
    const nextEnd = lastChar(next);
    if (shouldStripEnd(nextStart, nextEnd)) {
      next = trimLastChar(next);
    }

    if (next === current) {
      return current;
    }
    current = next;
  }
}

export function normalizeOcrText(text: string) {
  return removeIgnoredCharacters(text)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(normalizeLine)
    .join('\n')
    .replace(new RegExp(`\\n{${MAX_PARAGRAPH_BREAKS + 1},}`, 'g'), '\n\n')
    .trim();
}
