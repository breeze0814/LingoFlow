import { resolveOcrTranslateDirection } from '../../features/ocr/ocrTranslateDirection';

describe('ocrTranslateDirection', () => {
  it('maps likely Chinese OCR text to English target', () => {
    expect(resolveOcrTranslateDirection('这是 一段 中文 识别结果')).toEqual({
      sourceLanguageLabel: '简体中文',
      targetLanguageCode: 'en',
      targetLanguageLabel: '英语',
    });
  });

  it('maps English OCR text to Chinese target', () => {
    expect(resolveOcrTranslateDirection('This is an English OCR result')).toEqual({
      sourceLanguageLabel: '自动识别',
      targetLanguageCode: 'zh-CN',
      targetLanguageLabel: '简体中文',
    });
  });
});
