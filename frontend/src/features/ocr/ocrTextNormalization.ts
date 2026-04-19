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

const IGNORED_CONTROL_CODEPOINTS = new Set([
  0x0000, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007, 0x0008, 0x000b, 0x000c, 0x000e,
  0x000f, 0x0010, 0x0011, 0x0012, 0x0013, 0x0014, 0x0015, 0x0016, 0x0017, 0x0018, 0x0019, 0x001a,
  0x001b, 0x001c, 0x001d, 0x001e, 0x001f, 0x007f, 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff,
]);

function removeIgnoredCharacters(text: string) {
  return Array.from(text)
    .filter((char) => !IGNORED_CONTROL_CODEPOINTS.has(char.codePointAt(0) ?? -1))
    .join('');
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

/**
 * Normalizes OCR-recognized text by removing control characters, collapsing whitespace,
 * trimming edge noise (misrecognized punctuation/symbols), and limiting paragraph breaks.
 *
 * This function performs the following transformations:
 * 1. Removes invisible control characters (zero-width spaces, BOM, etc.)
 * 2. Normalizes line endings to \n
 * 3. Collapses multiple spaces within lines to single spaces
 * 4. Trims leading/trailing whitespace from each line
 * 5. Removes misrecognized punctuation/symbols at line edges (e.g., stray quotes, bullets)
 * 6. Limits consecutive paragraph breaks to a maximum of 2 newlines
 *
 * The edge noise removal is intelligent: it preserves matching pairs of quotes/brackets
 * but removes unmatched ones that are likely OCR artifacts.
 *
 * @param text - The raw OCR text to normalize
 * @returns The normalized text with cleaned formatting
 *
 * @example
 * ```ts
 * // Removes control characters and edge noise
 * normalizeOcrText('• Hello World •\n\n\n\nNext paragraph')
 * // Returns: 'Hello World\n\nNext paragraph'
 *
 * // Preserves matching quotes
 * normalizeOcrText('"Hello World"')
 * // Returns: '"Hello World"'
 *
 * // Removes unmatched quotes
 * normalizeOcrText('"Hello World')
 * // Returns: 'Hello World'
 * ```
 */
export function normalizeOcrText(text: string) {
  return removeIgnoredCharacters(text)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(normalizeLine)
    .join('\n')
    .replace(new RegExp(`\\n{${MAX_PARAGRAPH_BREAKS + 1},}`, 'g'), '\n\n')
    .trim();
}
