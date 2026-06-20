import { GoogleAuthProvider, signInWithCredential, type Auth } from 'firebase/auth';

// Native (desktop) Google sign-in via a system-browser OAuth flow. The webview
// popup can't work, so we open Google in the real browser, catch the redirect
// on a Rust loopback server, exchange the code for an ID token (native fetch,
// no CORS), and sign into Firebase with that credential.
//
// Stays dormant unless the Google OAuth client is configured at build time:
// set VITE_GOOGLE_CLIENT_ID + VITE_GOOGLE_CLIENT_SECRET in .env. Without them,
// googleNativeReady() is false and the UI keeps the Google button hidden in the
// native app (email/password is unaffected).

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET as string | undefined;
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const TIMEOUT_MS = 180_000;

export function googleNativeReady(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

interface OauthPayload {
  query?: string | null;
  error?: string | null;
}

export async function signInWithGoogleNative(auth: Auth): Promise<void> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw { code: 'auros/google-not-configured', message: 'Google sign-in isn’t set up for this build.' };
  }

  const { invoke } = await import('@tauri-apps/api/core');
  const { once } = await import('@tauri-apps/api/event');
  const { fetch: nativeFetch } = await import('@tauri-apps/plugin-http');
  const { openUrl } = await import('@tauri-apps/plugin-opener');

  const state = crypto.randomUUID();

  // 1) Rust binds a loopback port and waits for the one redirect.
  const port = (await invoke('start_google_oauth')) as number;
  const redirectUri = `http://127.0.0.1:${port}`;

  // 2) Register the result listener *before* opening the browser.
  const payload = await new Promise<OauthPayload>((resolve, reject) => {
    const timer = setTimeout(() => reject({ code: 'auros/google-oauth', message: 'Sign-in timed out.' }), TIMEOUT_MS);
    once<OauthPayload>('auros://oauth', (e) => {
      clearTimeout(timer);
      resolve(e.payload);
    }).then(() => {
      // 3) Open Google's consent screen in the system browser.
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account',
        access_type: 'online',
      });
      openUrl(`${AUTH_ENDPOINT}?${params.toString()}`).catch((err) => {
        clearTimeout(timer);
        reject({ code: 'auros/google-oauth', message: String(err) });
      });
    });
  });

  if (payload.error) throw { code: 'auros/google-oauth', message: payload.error };

  const q = new URLSearchParams(payload.query || '');
  if (q.get('state') !== state) throw { code: 'auros/google-oauth', message: 'Sign-in could not be verified (state mismatch).' };
  const code = q.get('code');
  if (!code) throw { code: 'auros/google-oauth', message: q.get('error') || 'Google did not return an authorization code.' };

  // 4) Exchange the code for an ID token (native fetch bypasses CORS).
  const body = new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const resp = await nativeFetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const tok = (await resp.json()) as { id_token?: string; error?: string; error_description?: string };
  if (!tok.id_token) {
    throw { code: 'auros/google-oauth', message: tok.error_description || tok.error || 'Token exchange failed.' };
  }

  // 5) Sign into Firebase with the Google credential.
  await signInWithCredential(auth, GoogleAuthProvider.credential(tok.id_token));
}
