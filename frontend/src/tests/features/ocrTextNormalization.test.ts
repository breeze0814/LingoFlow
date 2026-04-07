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

  it('removes unbalanced quotes and obvious edge noise', () => {
    expect(normalizeOcrText('“Hello world')).toBe('Hello world');
    expect(normalizeOcrText('Hello world”')).toBe('Hello world');
    expect(normalizeOcrText('|『Hello world')).toBe('Hello world');
  });

  it('preserves balanced wrappers while removing invisible characters', () => {
    expect(normalizeOcrText('\u200B “Hello world” \uFEFF')).toBe('“Hello world”');
    expect(normalizeOcrText('【Hello world】')).toBe('【Hello world】');
  });
});
