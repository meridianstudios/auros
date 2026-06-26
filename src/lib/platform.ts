import { Capacitor } from '@capacitor/core';

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

// True when running inside the Capacitor native shell (Android) vs the browser or
// Tauri. Used to avoid Firebase's signInWithPopup, which can't complete inside a
// WebView (it dead-ends on a blank screen). Primary signal is Capacitor's own
// platform check; the raw injected global is used as a fallback because its shape
// isn't guaranteed, and we never want a stale "web" reading to leave the broken
// Google popup visible on Android.
function detectCapacitor(): boolean {
  try { if (Capacitor.isNativePlatform()) return true; } catch { /* fall through */ }
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string; platform?: string };
  }).Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return true;
  if (typeof cap.getPlatform === 'function' && cap.getPlatform() !== 'web') return true;
  return typeof cap.platform === 'string' && cap.platform !== 'web';
}

export const isCapacitor: boolean = detectCapacitor();
