import { isNative, isCapacitor } from './platform';

// Auros Live music delivery. To keep the native app installers small, the audio
// is NOT bundled into the Tauri/Android builds (it's stripped at build time —
// see scripts/strip-live-music.mjs). Instead the apps stream each track from the
// deployed web host on demand and cache it on-device via the Cache API, so a
// track downloads at most once and the user can clear the whole lot from Settings.
//
// On the web/PWA (and dev) the audio is same-origin, so we just use a relative
// path; only the native shells need the absolute remote URL.
const REMOTE = 'https://auros.novalabsos.com/live-music';
const BASE = isNative || isCapacitor ? REMOTE : '/live-music';

export const musicUrl = (filename: string) => `${BASE}/${encodeURIComponent(filename)}`;

const CACHE = 'auros-live-music';
const canCache = typeof caches !== 'undefined';

// Return a playable URL for a track: served from the on-device cache if it's been
// downloaded before, otherwise fetched once, cached, and played from a blob URL.
// Falls back to streaming the URL directly if the Cache API or the network fails,
// so music still plays even when caching isn't available.
export async function getPlayableUrl(url: string): Promise<string> {
  if (!canCache) return url;
  try {
    const cache = await caches.open(CACHE);
    let resp = await cache.match(url);
    if (!resp) {
      const net = await fetch(url);
      if (!net.ok) throw new Error(`HTTP ${net.status}`);
      await cache.put(url, net.clone());
      resp = net;
    }
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  } catch {
    return url;
  }
}

// Total bytes of downloaded tracks, for the Settings "clear" control.
export async function musicCacheBytes(): Promise<number> {
  if (!canCache) return 0;
  try {
    const cache = await caches.open(CACHE);
    const keys = await cache.keys();
    let total = 0;
    for (const req of keys) {
      const r = await cache.match(req);
      if (!r) continue;
      const len = r.headers.get('content-length');
      total += len ? Number(len) : (await r.blob()).size;
    }
    return total;
  } catch {
    return 0;
  }
}

// Delete every downloaded track. Playback re-downloads on demand afterward.
export async function clearMusicCache(): Promise<void> {
  if (!canCache) return;
  try { await caches.delete(CACHE); } catch { /* ignore */ }
}
