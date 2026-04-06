import type { ReactElement } from 'react';

type ProviderGlyphProps = {
  icon: string;
};

const PROVIDER_GLYPHS: Record<string, ReactElement> = {
  ocr: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="4" fill="#10a37f" />
      <path fill="#ffffff" d="M8.6 9.2h1.6l1.2 5.4h.1l1.2-5.4h1.6l-1.9 7.1h-1.8L8.6 9.2Z" />
      <path fill="#ffffff" d="M16.2 9.2a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2h-1.9V9.2h1.9Zm-.3 1.4v4h.4a.6.6 0 0 0 .6-.6v-2.8a.6.6 0 0 0-.6-.6h-.4Z" />
    </svg>
  ),
  google: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285f4" d="M12 3a9 9 0 0 1 6.3 2.5l-2.6 2.5A5.4 5.4 0 0 0 12 6.5 5.5 5.5 0 0 0 6.8 10H3.4A9 9 0 0 1 12 3Z" />
      <path fill="#34a853" d="M3.4 10H6.8A5.5 5.5 0 0 0 12 17.5a5.1 5.1 0 0 0 3.6-1.3l2.8 2.2A9 9 0 0 1 3 14a9.5 9.5 0 0 1 .4-4Z" />
      <path fill="#fbbc05" d="M18.4 18.4 15.6 16.2A5.2 5.2 0 0 0 17.2 13h-5.2V9.7H21a9.1 9.1 0 0 1-2.6 8.7Z" />
      <path fill="#ea4335" d="M21 9.7h-3.8A5.2 5.2 0 0 0 15.7 8l2.6-2.5A8.8 8.8 0 0 1 21 9.7Z" />
    </svg>
  ),
  deepl: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="7" width="14" height="10" rx="3" fill="#0f2b46" />
      <circle cx="9" cy="12" r="1.6" fill="#fff" />
      <circle cx="12" cy="12" r="1.6" fill="#fff" />
      <circle cx="15" cy="12" r="1.6" fill="#fff" />
    </svg>
  ),
  bing: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#008373" d="M8 3.5v7.7l4.9 2.2-3.6 2v4.1l8.7-4.8v-3.3L12 8.8V3.5H8Z" />
    </svg>
  ),
  youdao: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#0c7a9e" d="M6 5.5h6.8c1.9 0 3.2.8 4.2 2v11c-1-.9-2.3-1.5-4-1.5H6V5.5Zm11 0h1v11h-1V5.5Z" />
    </svg>
  ),
  tencent: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#00a4ff" d="M8.5 17a4.5 4.5 0 0 1 .7-8.9A5 5 0 0 1 18.6 9a3.6 3.6 0 0 1 .4 7.1H8.5Z" />
    </svg>
  ),
  baidu: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="2" fill="#2932e1" />
      <circle cx="15" cy="8" r="2" fill="#2932e1" />
      <circle cx="6.5" cy="12" r="1.7" fill="#2932e1" />
      <circle cx="17.5" cy="12" r="1.7" fill="#2932e1" />
      <path fill="#2932e1" d="M12 11.5c-3.2 0-5 2-5 4.4 0 2.1 1.5 3.6 5 3.6s5-1.5 5-3.6c0-2.4-1.8-4.4-5-4.4Z" />
    </svg>
  ),
  azure: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#0078d4" d="m12.4 4.5 5.8 13.6H7.3l3.3-6-2.3-2.9 4.1-4.7Zm-1.8 8.8 2.3 4.8H5.8l4.8-4.8Z" />
    </svg>
  ),
  openai: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#10a37f" d="M12 4.5a3.4 3.4 0 0 1 3.3 2.6 3.4 3.4 0 0 1 3.7 5.3 3.4 3.4 0 0 1-1.5 5.9 3.4 3.4 0 0 1-5.5 1.7 3.4 3.4 0 0 1-5.5-1.8 3.4 3.4 0 0 1-1.6-5.8 3.4 3.4 0 0 1 3.7-5.3A3.4 3.4 0 0 1 12 4.5Zm0 2.3-1.9 1.1v2.2l1.9 1.1 1.9-1.1V7.9L12 6.8Zm-3.8 3.3-1 1.8 1 1.8H10l1-1.8-1-1.8H8.2Zm7.6 0H14l-1 1.8 1 1.8h1.8l1-1.8-1-1.8Zm-3.8 3.4-1.9 1.1v2.2l1.9 1.1 1.9-1.1v-2.2L12 13.5Z" />
    </svg>
  ),
};

const FALLBACK_PROVIDER_GLYPH = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8" fill="#6b7280" />
  </svg>
);

export function ProviderGlyph({ icon }: ProviderGlyphProps) {
  return PROVIDER_GLYPHS[icon] ?? FALLBACK_PROVIDER_GLYPH;
}
