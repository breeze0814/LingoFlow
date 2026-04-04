function normalizeLine(line: string) {
  return line.replace(/[^\S\r\n]+/g, ' ').trim();
}

export function normalizeOcrText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(normalizeLine)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
