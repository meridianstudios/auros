// True when running inside the native Tauri shell (desktop/mobile app) rather
// than the web/PWA. Used to gate native-only behavior (auth flow, Level-3 radar).
export const isNative =
  typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
