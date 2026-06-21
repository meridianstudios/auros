import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const appVersion = JSON.parse(readFileSync('./package.json', 'utf8')).version as string;

// Tauri sets TAURI_ENV_* env vars when it runs this build — use that to bake a
// reliable "native app" flag into the bundle (runtime webview detection was
// unreliable on Windows). Web builds (no TAURI_ENV) get false.
const isTauriBuild = !!process.env.TAURI_ENV_PLATFORM;
console.log('[build] native (Tauri):', isTauriBuild, process.env.TAURI_ENV_PLATFORM || '(web)');

// The nexrad-level-3-data decoder discovers its product/packet modules with
// fs.readdirSync(__dirname) — Node-only, breaks in the browser. Rewrite those two
// index files to explicit requires at build time (node_modules left untouched).
const NEXRAD_PRODUCTS = `
const productsRaw = [require('./56'),require('./58'),require('./59'),require('./61'),require('./62'),require('./78'),require('./80'),require('./94'),require('./141'),require('./165'),require('./170'),require('./172'),require('./177')];
const products = {};
productsRaw.forEach((p) => { if (products[p.code]) throw new Error('Duplicate product code ' + p.code); products[p.code] = p; });
const productAbbreviations = productsRaw.map((p) => p.abbreviation).flat();
module.exports = { products, productAbbreviations };
`;
const NEXRAD_PACKETS = `
const packetsRaw = [require('./1'),require('./2'),require('./6'),require('./8'),require('./10'),require('./13'),require('./14'),require('./15'),require('./16'),require('./17'),require('./18'),require('./19'),require('./32'),require('./a'),require('./af1f'),require('./c'),require('./f')];
const packets = {};
packetsRaw.forEach((p) => { if (packets[p.code]) throw new Error('Duplicate packet code ' + p.code); packets[p.code] = p; });
const parser = (raf, productDescription) => {
  const packetCode = raf.readUShort();
  raf.skip(-2);
  const packetCodeHex = packetCode.toString(16).padStart(4, '0');
  const packet = packets[packetCode];
  if (!packet) throw new Error('Unsupported packet code 0x' + packetCodeHex);
  return packet.parser(raf, productDescription);
};
module.exports = { packets, parser };
`;
function nexradL3BrowserFix(): Plugin {
  return {
    name: 'nexrad-l3-browser-fix',
    enforce: 'pre',
    transform(_code, id) {
      const norm = id.replace(/\\/g, '/');
      if (!norm.includes('nexrad-level-3-data')) return null;
      if (norm.endsWith('/products/index.js')) return { code: NEXRAD_PRODUCTS, map: null };
      if (norm.endsWith('/packets/index.js')) return { code: NEXRAD_PACKETS, map: null };
      return null;
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  define: { __IS_NATIVE__: JSON.stringify(isTauriBuild), __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [
    nexradL3BrowserFix(),
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
