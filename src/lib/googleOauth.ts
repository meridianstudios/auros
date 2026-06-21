import { GoogleAuthProvider, signInWithCredential, type Auth } from 'firebase/auth';

// Native (desktop + Android) Google sign-in via a system-browser OAuth flow. The
// webview popup can't work, so we open Google in the real browser, catch the
// redirect on a Rust loopback server, exchange the code for an ID token (native
// fetch, no CORS), and sign into Firebase with that credential.
//
// IMPORTANT: this must use a Google "Desktop app" (installed-app) OAuth client,
// NOT a "Web application" client. A web client's secret is confidential and must
// never ship inside a distributed binary; a desktop client's secret is, by
// Google's own design, NOT confidential, so it is safe to embed. We also use
// PKCE (RFC 7636) to protect the code exchange. The web build signs in with
// Firebase's popup + the separate Web client and never needs these values.
//
// Stays dormant unless configured at build time: set VITE_GOOGLE_CLIENT_ID +
// VITE_GOOGLE_CLIENT_SECRET in .env to the *Desktop* client's values. Without
// them, googleNativeReady() is false and the Google button stays hidden in the
// native app (email/password is unaffected).
//
// Firebase must be told to trust this client, or the ID token is rejected with
// "audience mismatch": in Firebase Console > Authentication > Sign-in method >
// Google, add the Desktop client ID to the list of allowed client IDs.

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

// PKCE helpers (RFC 7636): a random verifier and its S256 challenge, base64url
// encoded without padding.
function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createPkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
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
  const { verifier, challenge } = await createPkce();

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
      // 3) Open Google's consent screen in the system browser, with the PKCE
      //    challenge so the token exchange can prove it's the same client.
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account',
        access_type: 'online',
        code_challenge: challenge,
        code_challenge_method: 'S256',
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

  // 4) Exchange the code for an ID token (native fetch bypasses CORS). The PKCE
  //    code_verifier is what actually secures this exchange; the desktop client
  //    secret is included because Google's token endpoint expects it, but it is
  //    non-confidential for installed-app clients.
  const body = new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: verifier,
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
