import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { OcrPreviewApp } from './features/ocr/OcrPreviewApp';
import { OcrRuntimeApp } from './features/ocr/OcrRuntimeApp';
import { OcrResultWindowApp } from './features/ocr/OcrResultWindowApp';
import { ScreenshotOverlayApp } from './features/screenshot/ScreenshotOverlayApp';
import './styles/design-tokens.css';
import './styles/layout.css';
import './styles/settings-panel.css';
import './styles/provider-panel.css';
import './styles/ocr-result-panel.css';
import './styles/ocr-result-workbench-shell.css';
import './styles/ocr-result-workbench-cards.css';
import './styles/screenshot-overlay.css';
import './styles/translator.css';

type WindowViewMode =
  | 'main'
  | 'ocr_preview'
  | 'ocr_result'
  | 'ocr_runtime'
  | 'screenshot_overlay';

function detectWindowViewMode(): WindowViewMode {
  if (typeof window === 'undefined') {
    return 'main';
  }
  const params = new URLSearchParams(window.location.search);
  const windowType = params.get('window');
  if (
    windowType === 'ocr_preview' ||
    windowType === 'ocr_result' ||
    windowType === 'ocr_runtime' ||
    windowType === 'screenshot_overlay'
  ) {
    return windowType;
  }
  return 'main';
}

const windowViewMode = detectWindowViewMode();
document.body.dataset.windowType = windowViewMode === 'ocr_preview' ? 'ocr_result' : windowViewMode;
const rootView =
  windowViewMode === 'ocr_preview' ? (
    <OcrPreviewApp />
  ) : windowViewMode === 'ocr_result' ? (
    <OcrResultWindowApp />
  ) : windowViewMode === 'ocr_runtime' ? (
    <OcrRuntimeApp />
  ) : windowViewMode === 'screenshot_overlay' ? (
    <ScreenshotOverlayApp />
  ) : (
    <App />
  );

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{rootView}</React.StrictMode>,
);
