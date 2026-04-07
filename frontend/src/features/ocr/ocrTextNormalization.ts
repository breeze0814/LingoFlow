const MAX_PARAGRAPH_BREAKS = 2;

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
  return text.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B\u200C\u200D\u2060\uFEFF]/g,
    '',
  );
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
