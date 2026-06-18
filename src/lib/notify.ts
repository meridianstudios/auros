// Web Notification API (foreground). Background push when the app is closed needs
// a service-worker push subscription + a server — that's Phase 3 (see SPEC).

export async function ensurePermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const res = await Notification.requestPermission();
  return res === 'granted';
}

export async function notify(title: string, body: string): Promise<boolean> {
  const ok = await ensurePermission();
  if (!ok) return false;
  try {
    new Notification(title, { body, icon: '/icon.svg' });
    return true;
  } catch {
    return false;
  }
}
