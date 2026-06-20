import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Tauri sets TAURI_ENV_* env vars when it runs this build — use that to bake a
// reliable "native app" flag into the bundle (runtime webview detection was
// unreliable on Windows). Web builds (no TAURI_ENV) get false.
const isTauriBuild = !!process.env.TAURI_ENV_PLATFORM;
console.log('[build] native (Tauri):', isTauriBuild, process.env.TAURI_ENV_PLATFORM || '(web)');

// https://vite.dev/config/
export default defineConfig({
  define: { __IS_NATIVE__: JSON.stringify(isTauriBuild) },
  plugins: [
    react(),
    VitePWA({
      // No service worker in the native app — assets are served locally, and a SW
      // just caches a stale frontend in the WebView profile (survives reinstalls).
      disable: isTauriBuild,
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Auros',
        short_name: 'Auros',
        description: 'Severe-weather awareness — alerts, SPC outlook, and radar.',
        theme_color: '#0B1020',
        background_color: '#0B1020',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});
