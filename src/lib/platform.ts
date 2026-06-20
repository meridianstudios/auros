// True when running inside the native Tauri shell (desktop/mobile app) vs the
// web/PWA. The injected globals can be timing-sensitive, so the most reliable
// signal is the origin Tauri serves from: http(s)://tauri.localhost on Windows,
// tauri://localhost on macOS/Linux/mobile.
function detectNative(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  if (w.__TAURI_INTERNALS__ || w.__TAURI__ || w.isTauri) return true;
  const { protocol, hostname } = window.location;
  return protocol === 'tauri:' || hostname === 'tauri.localhost' || hostname.endsWith('.tauri.localhost');
}

export const isNative = detectNative();
