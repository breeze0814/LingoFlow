import { describe, expect, it } from 'vitest';
import { buildDisplayRows } from '../../features/ocr/ocrResultRows';

describe('ocrResultRows', () => {
  it('sorts provider results by fixed workspace priority', () => {
    const rows = buildDisplayRows({
      taskId: 'task_ocr_rows_1',
      providerId: 'google_translate',
      sourceText: 'with macOS sonoma',
      translationResults: [
        { providerId: 'youdao_web', translatedText: '通过 macOS Sonoma' },
        { providerId: 'google_translate', translatedText: '借助 macOS Sonoma' },
        { providerId: 'deepl_free', translatedText: '采用 macOS Sonoma' },
      ],
    });

    expect(rows.map((row) => row.providerId)).toEqual([
      'deepl_free',
      'google_translate',
      'youdao_web',
    ]);
  });
});
