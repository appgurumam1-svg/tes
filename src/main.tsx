import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, storedThemeMode } from './lib/theme';
import './styles.css';

applyTheme(storedThemeMode());

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Elemen #root tidak ditemukan di index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
