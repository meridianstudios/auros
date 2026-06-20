import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { isNative } from './lib/platform';

if ('serviceWorker' in navigator) {
  if (isNative) {
    // Native app serves assets locally — strip any stale PWA service worker + its
    // caches (left by an earlier web-SW build) so it always loads fresh.
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
    if ('caches' in window) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
  } else {
    // Web/PWA: reload once when a new service-worker version takes control, so new
    // deploys appear without needing a manual hard-refresh.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
