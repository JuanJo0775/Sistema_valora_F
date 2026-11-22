import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-500.css';
import '@fontsource/figtree/latin-600.css';
import '@fontsource/figtree/latin-700.css';
import '@fontsource/outfit/latin-500.css';
import '@fontsource/outfit/latin-600.css';
import '@fontsource/outfit/latin-700.css';
import './shared/ui/tokens.css';
import './shared/ui/base.css';
import { App } from './app/App';
import './shared/ui/web.css';
import './shared/ui/highlight.css';
import { startInstallListener } from './pwa/install';
import { applyStoredTheme } from './shared/theme';

applyStoredTheme();
// El aviso de instalación puede llegar antes de que se pinte la pantalla: se escucha desde ya.
startInstallListener();

const root = document.getElementById('root');
if (!root) throw new Error('Falta el elemento #root en index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
