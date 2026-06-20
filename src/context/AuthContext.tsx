import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, googleProvider, firebaseReady } from '../lib/firebase';

interface AuthValue {
  ready: boolean; // Firebase configured?
  user: User | null;
  loading: boolean;
  signInEmail: (email: string, pw: string) => Promise<void>;
  signUpEmail: (name: string, email: string, pw: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseReady);

  useEffect(() => {
    if (!firebaseReady || !auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const value: AuthValue = {
    ready: firebaseReady,
    user,
    loading,
    signInEmail: async (email, pw) => { await signInWithEmailAndPassword(auth!, email, pw); },
    signUpEmail: async (name, email, pw) => {
      const cred = await createUserWithEmailAndPassword(auth!, email, pw);
      if (name) await updateProfile(cred.user, { displayName: name });
    },
    signInGoogle: async () => { await signInWithPopup(auth!, googleProvider); },
    // Works for Google-only accounts too: completing the reset sets a password,
    // which adds the email/password provider so they can sign in without Google.
    resetPassword: async (email) => { await sendPasswordResetEmail(auth!, email); },
    logout: async () => { await signOut(auth!); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
