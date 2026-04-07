import {
  englishVoiceLocale,
  resolveConfiguredSourceLanguage,
  selectPrimaryTranslatedText,
  selectSpokenEnglishWord,
} from '../../features/settings/settingsRuntime';

describe('settingsRuntime', () => {
  it('uses auto source language only for the default primary language in auto mode', () => {
    expect(
      resolveConfiguredSourceLanguage('en', {
        detectionMode: 'auto',
        primaryLanguage: 'en',
      }),
    ).toBe('auto');
    expect(
      resolveConfiguredSourceLanguage('ja', {
        detectionMode: 'auto',
        primaryLanguage: 'en',
      }),
    ).toBe('ja');
    expect(
      resolveConfiguredSourceLanguage('en', {
        detectionMode: 'system_only',
        primaryLanguage: 'en',
      }),
    ).toBe('en');
  });

  it('prefers the pinned provider result for auto copy', () => {
    expect(
      selectPrimaryTranslatedText(
        {
          taskId: 'task_1',
          providerId: 'bing_web',
          sourceText: 'hello',
          translatedText: '你好',
          translationResults: [
            { providerId: 'bing_web', translatedText: '你好' },
            { providerId: 'deepl_free', translatedText: '您好' },
          ],
        },
        'deepl_free',
      ),
    ).toBe('您好');
  });

  it('only speaks translated english single words', () => {
    expect(
      selectSpokenEnglishWord({
        taskId: 'task_2',
        providerId: 'deepl_free',
        sourceText: 'hello',
        translatedText: '你好',
      }),
    ).toBe('hello');
    expect(
      selectSpokenEnglishWord({
        taskId: 'task_3',
        providerId: 'deepl_free',
        sourceText: 'hello world',
        translatedText: '你好世界',
      }),
    ).toBeNull();
    expect(englishVoiceLocale('us')).toBe('en-US');
    expect(englishVoiceLocale('uk')).toBe('en-GB');
  });
});
