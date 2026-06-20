// True when running inside the native Tauri shell (desktop/mobile app) vs the
// web/PWA. Primary signal is a build-time flag baked in by Vite (set true only
// when Tauri runs the build — see vite.config.ts); a runtime origin/globals
// check is kept as a fallback.
declare const __IS_NATIVE__: boolean;

function detectNativeRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  if (w.__TAURI_INTERNALS__ || w.__TAURI__ || w.isTauri) return true;
  const { protocol, hostname } = window.location;
  return protocol === 'tauri:' || hostname === 'tauri.localhost' || hostname.endsWith('.tauri.localhost');
}

export const isNative: boolean = __IS_NATIVE__ || detectNativeRuntime();
