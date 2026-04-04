import { resolveTesseractLanguages } from '../../features/ocr/ocrRuntimeLanguage';

describe('ocrRuntimeLanguage', () => {
  it('prefers Chinese plus English when hint is zh-CN', () => {
    expect(resolveTesseractLanguages('zh-CN')).toEqual(['chi_sim', 'eng']);
  });

  it('returns Japanese with English fallback', () => {
    expect(resolveTesseractLanguages('ja')).toEqual(['jpn', 'eng']);
  });

  it('falls back to Chinese plus English without hint', () => {
    expect(resolveTesseractLanguages(undefined)).toEqual(['chi_sim', 'eng']);
  });
});
