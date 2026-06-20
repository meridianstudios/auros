import { isNative } from './platform';

// Open a URL in the user's real browser. In the native shell we route through
// the Tauri opener plugin (the webview would otherwise navigate in-app or open
// a blank window); on web a normal new tab is correct.
export async function openExternal(url: string): Promise<void> {
  if (isNative) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
      return;
    } catch {
      // Fall through to window.open if the plugin can't be reached.
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

// Native only: catch clicks on any external http(s) <a> and send it to the
// system browser instead of letting the webview try to handle it. One listener
// covers every current and future link — no per-link wiring. No-op on web.
export function installNativeLinkHandler(): void {
  if (!isNative || typeof document === 'undefined') return;
  document.addEventListener('click', (e) => {
    const anchor = (e.target as HTMLElement | null)?.closest?.('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href') || '';
    if (/^https?:\/\//i.test(href)) {
      e.preventDefault();
      void openExternal(href);
    }
  });
}
