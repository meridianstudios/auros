// Notifications. Native (Tauri) uses the OS notification system via the
// notification plugin — the WebView's Web Notification API is blocked by default,
// which is why it reported "blocked". Web/PWA uses the Web Notification API.
// Background push when the app is closed still needs a server (Phase 3).
import { isNative } from './platform';

export async function ensurePermission(): Promise<boolean> {
  if (isNative) {
    try {
      const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
      if (await isPermissionGranted()) return true;
      return (await requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

export async function notify(title: string, body: string): Promise<boolean> {
  const ok = await ensurePermission();
  if (!ok) return false;
  if (isNative) {
    try {
      const { sendNotification } = await import('@tauri-apps/plugin-notification');
      sendNotification({ title, body });
      return true;
    } catch {
      return false;
    }
  }
  try {
    new Notification(title, { body, icon: '/icon.svg' });
    return true;
  } catch {
    return false;
  }
}
