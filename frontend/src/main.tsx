import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import './styles/variables.css';
import './styles/layout.css';
import './styles/settings-panel.css';
import './styles/provider-panel.css';
import './styles/input-dialog.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
