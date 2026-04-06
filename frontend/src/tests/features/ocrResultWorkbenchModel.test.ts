import { describe, expect, it } from 'vitest';
import { buildResultState } from '../../features/ocr/ocrResultWorkbenchModel';

describe('ocrResultWorkbenchModel', () => {
  it('puts the preferred provider first in a single ordered list', () => {
    const state = buildResultState(
      [
        { providerId: 'deepl_free', content: '你好世界', isError: false },
        { providerId: 'google_translate', content: '你好，世界', isError: false },
        { providerId: 'bing_web', content: '你好，世界。', isError: false },
      ],
      'bing_web',
      ['deepl_free', 'google_translate', 'bing_web'],
    );

    expect(state.orderedRows.map((item) => item.providerId)).toEqual([
      'bing_web',
      'deepl_free',
      'google_translate',
    ]);
    expect(state.orderedRows[0]?.isPinned).toBe(true);
  });

  it('keeps enabled providers visible even without translation results', () => {
    const state = buildResultState([], null, ['youdao_web', 'bing_web', 'deepl_free']);

    expect(state.orderedRows.map((item) => item.providerId)).toEqual([
      'deepl_free',
      'bing_web',
      'youdao_web',
    ]);
    expect(state.orderedRows.every((item) => item.hasResult === false)).toBe(true);
    expect(state.orderedRows.every((item) => item.statusLabel === '等待中')).toBe(true);
  });
});
