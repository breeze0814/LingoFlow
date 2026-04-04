import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { OcrRuntimeApp } from './features/ocr/OcrRuntimeApp';
import { OcrResultWindowApp } from './features/ocr/OcrResultWindowApp';
import { ScreenshotOverlayApp } from './features/screenshot/ScreenshotOverlayApp';
import './styles/design-tokens.css';
import './styles/variables.css';
import './styles/layout.css';
import './styles/settings-panel.css';
import './styles/provider-panel.css';
import './styles/ocr-result-panel.css';
import './styles/screenshot-overlay.css';
import './styles/translator.css';

type WindowViewMode = 'main' | 'ocr_result' | 'ocr_runtime' | 'screenshot_overlay';

function detectWindowViewMode(): WindowViewMode {
  if (typeof window === 'undefined') {
    return 'main';
  }
  const params = new URLSearchParams(window.location.search);
  const windowType = params.get('window');
  if (
    windowType === 'ocr_result' ||
    windowType === 'ocr_runtime' ||
    windowType === 'screenshot_overlay'
  ) {
    return windowType;
  }
  return 'main';
}

const windowViewMode = detectWindowViewMode();
document.body.dataset.windowType = windowViewMode;
const rootView =
  windowViewMode === 'ocr_result' ? (
    <OcrResultWindowApp />
  ) : windowViewMode === 'ocr_runtime' ? (
    <OcrRuntimeApp />
  ) : windowViewMode === 'screenshot_overlay' ? (
    <ScreenshotOverlayApp />
  ) : (
    <App />
  );

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {rootView}
  </React.StrictMode>,
);
