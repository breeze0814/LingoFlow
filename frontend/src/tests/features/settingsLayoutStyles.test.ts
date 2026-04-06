import { readFileSync } from 'node:fs';

function readStyle(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function getRuleBlock(css: string, selector: string): string {
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
  return blocks.join('\n');
}

function normalizeDeclarations(block: string): string[] {
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function expectDeclaration(block: string, declaration: string) {
  expect(normalizeDeclarations(block)).toContain(declaration);
}

function expectNoDeclaration(block: string, declaration: string) {
  expect(normalizeDeclarations(block)).not.toContain(declaration);
}

describe('settings layout styles', () => {
  it('allows the page shell to grow with settings content', () => {
    const layoutCss = readStyle('../../styles/layout.css');
    const layoutShell = getRuleBlock(layoutCss, '.layoutShell');
    const layout = getRuleBlock(layoutCss, '.layout');
    const content = getRuleBlock(layoutCss, '.content');
    const settingsHome = getRuleBlock(layoutCss, '.settingsHome');
    const workspace = getRuleBlock(layoutCss, '.workspace');

    expectDeclaration(layoutShell, 'overflow-y: auto;');
    expectNoDeclaration(layoutShell, 'overflow: hidden;');
    expectDeclaration(layout, 'min-height: 100vh;');
    expectNoDeclaration(layout, 'height: 100vh;');
    expectDeclaration(content, 'min-height: 100%;');
    expectDeclaration(settingsHome, 'height: auto;');
    expectNoDeclaration(settingsHome, 'height: min(var(--desktop-window-height), 100vh);');
    expectDeclaration(workspace, 'height: auto;');
  });

  it('uses content-driven height inside settings tabs instead of inner scroll regions', () => {
    const settingsWindowCss = readStyle('../../styles/settings-window.css');
    const settingsControlsCss = readStyle('../../styles/settings-controls.css');
    const providerShellCss = readStyle('../../styles/provider-shell.css');

    const settingsPanel = getRuleBlock(settingsWindowCss, '.settingsPanel');
    const settingsShell = getRuleBlock(settingsWindowCss, '.settingsShell');
    const settingsContentPane = getRuleBlock(settingsWindowCss, '.settingsContentPane');
    const settingsBody = getRuleBlock(settingsControlsCss, '.settingsBody');
    const providerEditorPanel = getRuleBlock(providerShellCss, '.providerEditorPanel');
    const providerSectionList = getRuleBlock(providerShellCss, '.providerSectionList');

    expectDeclaration(settingsPanel, 'height: auto;');
    expectNoDeclaration(settingsPanel, 'height: 100%;');
    expectNoDeclaration(settingsShell, 'height: 100%;');
    expectDeclaration(settingsContentPane, 'grid-template-rows: auto auto;');
    expectNoDeclaration(settingsContentPane, 'grid-template-rows: auto minmax(0, 1fr);');
    expectDeclaration(settingsBody, 'overflow: visible;');
    expectNoDeclaration(settingsBody, 'overflow: auto;');
    expectDeclaration(providerEditorPanel, 'overflow: visible;');
    expectDeclaration(providerSectionList, 'height: auto;');
    expectDeclaration(providerSectionList, 'overflow: visible;');
  });
});
