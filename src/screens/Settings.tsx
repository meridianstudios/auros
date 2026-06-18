import { useState } from 'react';
import { Moon, Sun, Bell, ExternalLink } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { notify } from '../lib/notify';

export function Settings() {
  const { scheme, setScheme } = useTheme();
  const [msg, setMsg] = useState<string | null>(null);

  const test = async () => {
    const ok = await notify('Nova Weather test', 'Notifications are working.');
    setMsg(ok ? 'Sent — check your notifications.' : 'Blocked — enable notifications in browser/site settings.');
  };

  return (
    <div className="view fade">
      <div className="topbar"><h1>Settings</h1></div>
      <div className="pad">
        <div className="label">Appearance</div>
        <div className="seg">
          <button className={scheme === 'dark' ? 'on' : ''} onClick={() => setScheme('dark')}><Moon size={15} /> Dark</button>
          <button className={scheme === 'light' ? 'on' : ''} onClick={() => setScheme('light')}><Sun size={15} /> Light</button>
        </div>

        <div className="label">Notifications</div>
        <div className="card">
          <div className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
            Shows a notification when a warning is active for your location. Background push (even when the app is
            closed) arrives in Phase 3 with a service worker + server.
          </div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={test}><Bell size={16} /> Send a test notification</button>
          {msg && <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>{msg}</div>}
        </div>

        <div className="label">About</div>
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 17 }}>Nova Weather</div>
          <div className="dim" style={{ fontSize: 13, marginTop: 2 }}>v0.1.0 · Phase 1</div>
          <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 12 }}>
            Data from the National Weather Service, SPC, and RainViewer — all free and public domain. This app
            complements, and does not replace, a NOAA weather radio and Wireless Emergency Alerts.
          </div>
          <a href="https://www.weather.gov/" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, fontWeight: 600, fontSize: 14 }}>
            weather.gov <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
