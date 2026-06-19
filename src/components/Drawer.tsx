import { X, MapPin, CalendarDays, Bell, Info, Moon, Sun, User } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import type { View } from '../nav';

export function Drawer({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: (v: View) => void }) {
  const { scheme, setScheme } = useTheme();
  const go = (v: View) => { onNavigate(v); onClose(); };

  return (
    <>
      <div className={`drawer-dim ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <span className="t">Menu</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>

        {/* Account section — placeholder until auth (Phase 3) lands here. */}
        <div className="drawer-acct">
          <span className="av"><User size={18} /></span>
          <div>
            <div style={{ fontWeight: 500 }}>Guest</div>
            <div className="muted" style={{ fontSize: 13 }}>Sign in — coming soon</div>
          </div>
        </div>

        <button className="drawer-item" onClick={() => go('locations')}><MapPin size={19} /> Locations</button>
        <button className="drawer-item" onClick={() => go('forecast')}><CalendarDays size={19} /> Full forecast</button>
        <button className="drawer-item" onClick={() => go('alerts')}><Bell size={19} /> Alerts</button>
        <button className="drawer-item" onClick={() => go('settings')}><Info size={19} /> Settings &amp; about</button>

        <div className="drawer-seg">
          <div className="seg">
            <button className={scheme === 'dark' ? 'on' : ''} onClick={() => setScheme('dark')}><Moon size={15} /> Dark</button>
            <button className={scheme === 'light' ? 'on' : ''} onClick={() => setScheme('light')}><Sun size={15} /> Light</button>
          </div>
        </div>
      </aside>
    </>
  );
}
