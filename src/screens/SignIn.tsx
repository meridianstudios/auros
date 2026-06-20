import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isNative } from '../lib/platform';
import { googleNativeReady } from '../lib/googleOauth';
import { PasswordResetModal } from '../components/PasswordResetModal';
import type { View } from '../nav';

// Web always has Google (popup); the native app only when its OAuth client is
// configured at build time (otherwise it stays hidden and email/password rules).
const showGoogle = !isNative || googleNativeReady();

function prettyErr(e: unknown): string {
  const c = (e as { code?: string })?.code || '';
  if (/invalid-credential|wrong-password|user-not-found/.test(c)) return 'Wrong email or password.';
  if (c.includes('email-already-in-use')) return 'That email already has an account — try signing in.';
  if (c.includes('weak-password')) return 'Password should be at least 6 characters.';
  if (c.includes('invalid-email')) return 'That email looks invalid.';
  if (c.includes('popup-closed')) return 'Google sign-in was cancelled.';
  if (c.includes('argument-error') || c.includes('operation-not-supported')) return 'Google sign-in isn’t available here — use email & password.';
  return (e as { message?: string })?.message || 'Something went wrong.';
}

export function SignIn({ onNavigate }: { onNavigate: (v: View) => void }) {
  const { signInEmail, signUpEmail, signInGoogle } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      if (mode === 'up') await signUpEmail(name, email, pw);
      else await signInEmail(email, pw);
      onNavigate('home');
    } catch (e) { setErr(prettyErr(e)); } finally { setBusy(false); }
  };
  const google = async () => {
    setBusy(true); setErr(null);
    try { await signInGoogle(); onNavigate('home'); } catch (e) { setErr(prettyErr(e)); } finally { setBusy(false); }
  };

  return (
    <div className="view fade">
      <div className="topbar" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="icon-btn" aria-label="Back" onClick={() => onNavigate('home')}><ChevronLeft size={22} /></button>
        <h1 style={{ margin: 0, fontSize: 22 }}>{mode === 'up' ? 'Create account' : 'Sign in'}</h1>
      </div>
      <div className="pad" style={{ maxWidth: 380, margin: '0 auto', width: '100%' }}>
        <div className="card" style={{ marginTop: 12 }}>
          {mode === 'up' && (
            <input className="input" style={{ marginBottom: 10 }} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input className="input" style={{ marginBottom: 10 }} type="email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" type="password" placeholder="Password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{err}</div>}
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={submit} disabled={busy}>
            {busy ? '…' : mode === 'up' ? 'Create account' : 'Sign in'}
          </button>
          {mode === 'in' && (
            <button
              style={{ display: 'block', margin: '12px auto 0', color: 'var(--text-dim)', fontSize: 13 }}
              onClick={() => setResetOpen(true)}
              disabled={busy}
            >
              Forgot password? <span style={{ color: 'var(--primary)' }}>Reset or set one</span>
            </button>
          )}
          {showGoogle && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0', color: 'var(--text-dim)', fontSize: 12 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />or<div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <button className="btn btn-ghost" onClick={google} disabled={busy}>Continue with Google</button>
            </>
          )}
        </div>
        <div className="muted" style={{ textAlign: 'center', marginTop: 14, fontSize: 14 }}>
          {mode === 'up' ? 'Already have an account? ' : "Don't have an account? "}
          <button style={{ color: 'var(--primary)', fontWeight: 600 }} onClick={() => { setMode(mode === 'up' ? 'in' : 'up'); setErr(null); }}>
            {mode === 'up' ? 'Sign in' : 'Create one'}
          </button>
        </div>
      </div>
      {resetOpen && (
        <PasswordResetModal
          initialEmail={email}
          onClose={() => setResetOpen(false)}
          onDone={() => { setResetOpen(false); onNavigate('home'); }}
        />
      )}
    </div>
  );
}
