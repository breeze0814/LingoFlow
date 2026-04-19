import { readFileSync } from 'node:fs';

function readStyle(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function getRuleBlocks(css: string, selector: string): string[] {
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  const blocks: string[] = [];

  for (const match of css.matchAll(pattern)) {
    const selectors = match[1]
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    if (selectors.includes(selector)) {
      blocks.push(match[2]);
    }
  }

  if (blocks.length === 0) {
    throw new Error(`missing css rule: ${selector}`);
  }

  return blocks;
}

function getNormalizedDeclarations(block: string): string[] {
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

describe('ocr result workbench styles', () => {
  it('keeps provider header horizontal in condensed layouts', () => {
    const cardsCss = readStyle('../../styles/ocr-result-workbench-cards.css');
    const headerSelectors = [
      '.ocrCompactWindowCondensed .ocrProviderCardHeader',
      '.ocrProviderCardHeader',
    ] as const;
    const declarations = headerSelectors.flatMap((selector) =>
      getRuleBlocks(cardsCss, selector).flatMap((block) => getNormalizedDeclarations(block)),
    );

    expect(declarations).not.toContain('flex-direction: column;');
    expect(declarations).not.toContain('align-items: stretch;');
    expect(declarations).toContain('align-items: center;');
  });
});
