// Firebase init — reads public web config from VITE_FB_* env vars.
// If config is absent the app runs fully in local-only mode (auth disabled).

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
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

if (firebaseReady) {
  app = initializeApp(cfg);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { auth, db };
export const googleProvider = new GoogleAuthProvider();
