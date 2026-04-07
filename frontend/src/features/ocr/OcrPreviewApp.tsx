import { useState } from 'react';
import { LANGUAGE_OPTIONS } from '../settings/settingsTypes';
import { OcrResultPanel } from './OcrResultPanel';

const PREVIEW_ROWS = [
  {
    providerId: 'deepl_free',
    content: '这个窗口会把输入、语言切换和主结果压缩进一条更顺手的工作流里。',
    isError: false,
  },
  {
    providerId: 'google_translate',
    content: '这个小窗会把输入、语言方向与主结果收敛成更顺手的单列流程。',
    isError: false,
  },
  {
    providerId: 'openai_compatible',
    content: '这会让 Alt+F 打开的翻译窗更像一个专注的小工具，而不是主界面子页。',
    isError: false,
  },
  {
    providerId: 'youdao_web',
    content: '请求频率过高 (quota_exceeded)',
    isError: true,
  },
] as const;

const PREVIEW_TEXT = 'The Alt+F window should feel like a compact mobile-style translator.';

function languageLabel(code: string) {
  return LANGUAGE_OPTIONS.find((item) => item.value === code)?.label ?? code;
}

export function OcrPreviewApp() {
  const [text, setText] = useState(PREVIEW_TEXT);
  const [isPinned, setIsPinned] = useState(true);
  const [sourceLanguageCode, setSourceLanguageCode] = useState('en');
  const [targetLanguageCode, setTargetLanguageCode] = useState('zh-CN');
  const [preferredProviderId, setPreferredProviderId] = useState<string | null>('deepl_free');
  return (
    <main className="ocrResultWindowRoot">
      <OcrResultPanel
        autoQueryOnPaste={false}
        autoSelectTextOnOpen={false}
        errorMessage=""
        isPinned={isPinned}
        onClear={() => setText('')}
        onClose={() => undefined}
        onPromoteProvider={setPreferredProviderId}
        onSourceLanguageChange={setSourceLanguageCode}
        onSubmit={() => undefined}
        onSwapLanguages={() => {
          setSourceLanguageCode(targetLanguageCode);
          setTargetLanguageCode(sourceLanguageCode);
        }}
        onTargetLanguageChange={setTargetLanguageCode}
        onTextChange={setText}
        onTogglePin={() => setIsPinned((current) => !current)}
        enabledProviderIds={['deepl_free', 'google_translate', 'openai_compatible', 'youdao_web']}
        preferredProviderId={preferredProviderId}
        rows={[...PREVIEW_ROWS]}
        sourceLanguageCode={sourceLanguageCode}
        sourceLanguageLabel={languageLabel(sourceLanguageCode)}
        status="success"
        targetLanguageCode={targetLanguageCode}
        text={text}
        textSelectionToken="preview"
        targetLanguageLabel={languageLabel(targetLanguageCode)}
      />
    </main>
  );
}
