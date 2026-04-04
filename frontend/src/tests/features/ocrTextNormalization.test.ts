import { normalizeOcrText } from '../../features/ocr/ocrTextNormalization';

describe('ocrTextNormalization', () => {
  it('collapses repeated spaces inside each line while preserving line breaks', () => {
    expect(normalizeOcrText('Hello     world \n  OCR    result   here  ')).toBe(
      'Hello world\nOCR result here',
    );
  });

  it('compresses excessive blank lines without removing paragraph breaks', () => {
    expect(normalizeOcrText('Line  1\n\n\nLine   2')).toBe('Line 1\n\nLine 2');
  });
});
