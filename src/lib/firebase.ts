// Firebase init — reads public web config from VITE_FB_* env vars.
// If config is absent the app runs fully in local-only mode (auth disabled).

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const cfg = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

export const firebaseReady = Boolean(cfg.apiKey && cfg.projectId);

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

// In the native (Tauri) app the popup resolver loads Google's auth iframe (gapi),
// which is CORS-blocked on the tauri:// origin and crashes boot — so omit it there
// (email/password still works). The web/PWA keeps it for Google popup sign-in.
const IS_NATIVE = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

if (firebaseReady) {
  app = initializeApp(cfg);
  // Explicit local persistence so the session survives reloads and revisits
  // (the default resolution can fall back to in-memory, logging you out).
  auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    ...(IS_NATIVE ? {} : { popupRedirectResolver: browserPopupRedirectResolver }),
  });
  db = getFirestore(app);
}

export { auth, db };
export const googleProvider = new GoogleAuthProvider();
