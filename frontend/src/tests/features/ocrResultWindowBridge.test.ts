import { describe, expect, it } from 'vitest';
import { isOcrResultWindowPayload } from '../../features/ocr/ocrResultWindowBridge';

describe('ocrResultWindowBridge', () => {
  it('rejects removed clipboard translate payload mode', () => {
    expect(
      isOcrResultWindowPayload({
        autoTranslate: true,
        initialText: 'hello',
        mode: 'clipboard_translate',
        sourceLanguageLabel: '英语',
        targetLanguageCode: 'zh-CN',
        targetLanguageLabel: '简体中文',
      }),
    ).toBe(false);
  });
});
