import { X, MapPin, CalendarDays, Bell, Info, User, LogIn, LogOut, Tv } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { THEMES } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import type { View } from '../nav';

export function Drawer({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: (v: View) => void }) {
  const { scheme, setScheme } = useTheme();
  const { ready, user, logout } = useAuth();
  const go = (v: View) => { onNavigate(v); onClose(); };
  const initial = (user?.displayName || user?.email || '?').charAt(0).toUpperCase();

  return (
    <>
      <div className={`drawer-dim ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <span className="t">Menu</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>

        {user ? (
          <div className="drawer-acct">
            <span className="av" style={{ fontWeight: 600 }}>{initial}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.displayName || 'Signed in'}</div>
              <div className="muted" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
            </div>
          </div>
        ) : ready ? (
          <button className="drawer-acct" style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={() => go('signin')}>
            <span className="av"><LogIn size={18} /></span>
            <div><div style={{ fontWeight: 500 }}>Sign in</div><div className="muted" style={{ fontSize: 13 }}>Save &amp; sync your places</div></div>
          </button>
        ) : (
          <div className="drawer-acct">
            <span className="av"><User size={18} /></span>
            <div><div style={{ fontWeight: 500 }}>Guest</div><div className="muted" style={{ fontSize: 13 }}>Local only</div></div>
          </div>
        )}

        <button className="drawer-item" onClick={() => go('live')}><Tv size={19} /> Auros Live</button>
        <button className="drawer-item" onClick={() => go('locations')}><MapPin size={19} /> Locations</button>
        <button className="drawer-item" onClick={() => go('forecast')}><CalendarDays size={19} /> Full forecast</button>
        <button className="drawer-item" onClick={() => go('alerts')}><Bell size={19} /> Alerts</button>
        <button className="drawer-item" onClick={() => go('settings')}><Info size={19} /> Settings &amp; about</button>
        {user && (
          <button className="drawer-item" onClick={async () => { await logout(); onClose(); }}><LogOut size={19} /> Sign out</button>
        )}

        <div className="drawer-seg">
          <div className="theme-pick compact">
            {THEMES.map((t) => (
              <button
                key={t.key}
                className={`theme-card ${scheme === t.key ? 'on' : ''}`}
                onClick={() => setScheme(t.key)}
                aria-pressed={scheme === t.key}
              >
                <span className="theme-swatch" data-theme-swatch={t.key} />
                <span className="theme-name">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
