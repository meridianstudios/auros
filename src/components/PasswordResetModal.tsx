import { useState } from 'react';
import { X, MailCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// The reset email contains a link like
//   https://<project>.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=ABC…
// The oobCode IS the one-time code. Accept either the full pasted link or a bare
// code, so the user can just copy the link out of their email.
function extractCode(input: string): string {
  const s = input.trim();
  const m = s.match(/[?&]oobCode=([^&\s]+)/);
  return m ? decodeURIComponent(m[1]) : s;
}

function pretty(e: unknown): string {
  const c = (e as { code?: string })?.code || '';
  if (c.includes('operation-not-allowed'))
    return 'Email/password sign-in is turned off for this project — enable it in Firebase → Authentication → Sign-in method.';
  if (c.includes('expired-action-code')) return 'That link expired. Tap “Resend email” and use the newest one.';
  if (c.includes('invalid-action-code')) return 'That link is invalid or already used. Resend and paste the newest link.';
  if (c.includes('weak-password')) return 'Password should be at least 6 characters.';
  if (c.includes('user-not-found')) return 'No account uses that email.';
  if (c.includes('invalid-email')) return 'That email looks invalid.';
  if (c.includes('too-many-requests')) return 'Too many attempts — wait a minute and try again.';
  return (e as { message?: string })?.message || 'Something went wrong.';
}

export function PasswordResetModal({
  initialEmail,
  onClose,
  onDone,
}: {
  initialEmail?: string;
  onClose: () => void;
  onDone: (email: string) => void;
}) {
  const { resetPassword, completePasswordReset } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(initialEmail || '');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    if (!email.trim()) { setErr('Enter your email.'); return; }
    setBusy(true); setErr(null);
    try { await resetPassword(email.trim()); setStep('code'); }
    catch (e) { setErr(pretty(e)); }
    finally { setBusy(false); }
  };

  const finish = async () => {
    const c = extractCode(code);
    if (!c) { setErr('Paste the reset link (or code) from your email.'); return; }
    if (pw.length < 6) { setErr('Password should be at least 6 characters.'); return; }
    if (pw !== pw2) { setErr('Passwords don’t match.'); return; }
    setBusy(true); setErr(null);
    try {
      const who = await completePasswordReset(c, pw);
      onDone(who);
    } catch (e) { setErr(pretty(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet card" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" style={{ position: 'absolute', top: 10, right: 10 }} onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <h2 style={{ margin: '0 0 6px', fontSize: 19 }}>Reset password</h2>

        {step === 'email' ? (
          <>
            <p className="muted" style={{ fontSize: 13, marginTop: 0, lineHeight: 1.5 }}>
              We’ll email you a reset link. This works even if you only ever signed in with Google —
              it adds a password to your existing account.
            </p>
            <input
              className="input"
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            {err && <div className="reset-err">{err}</div>}
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={send} disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
              <MailCheck size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
              <p className="muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                Check your inbox <strong>and spam</strong> for an email from Auros. Open it, copy the
                reset link, paste it below, then pick a new password — or just tap the link in the
                email to reset in your browser.
              </p>
            </div>
            <textarea
              className="input"
              style={{ minHeight: 60, resize: 'vertical', fontSize: 12, marginTop: 8 }}
              placeholder="Paste the reset link from your email"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <input
              className="input"
              style={{ marginTop: 10 }}
              type="password"
              placeholder="New password"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
            <input
              className="input"
              style={{ marginTop: 10 }}
              type="password"
              placeholder="Confirm new password"
              autoComplete="new-password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && finish()}
            />
            {err && <div className="reset-err">{err}</div>}
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={finish} disabled={busy}>
              {busy ? 'Updating…' : 'Set password & sign in'}
            </button>
            <button
              style={{ display: 'block', margin: '10px auto 0', color: 'var(--text-dim)', fontSize: 12 }}
              onClick={send}
              disabled={busy}
            >
              Didn’t get it? Resend email
            </button>
          </>
        )}
      </div>
    </div>
  );
}
