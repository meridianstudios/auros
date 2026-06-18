import { useState } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { notify } from '../lib/notify';

export function Settings() {
  const { scheme, setScheme } = useTheme();
  const [msg, setMsg] = useState<string | null>(null);

  const test = async () => {
    const ok = await notify('Nova Weather test', 'Notifications are working ✅');
    setMsg(ok ? 'Sent! Check your notifications.' : 'Notifications are blocked — enable them in browser/site settings.');
  };

  return (
    <div className="view">
      <div className="bar"><h1>Settings</h1></div>
      <div className="pad" style={{ paddingTop: 12 }}>
        <div className="section">APPEARANCE</div>
        <div className="card">
          <div className="muted" style={{ marginBottom: 10 }}>Theme</div>
          <div className="seg">
            <button className={`btn ${scheme === 'dark' ? 'active' : 'idle'}`} onClick={() => setScheme('dark')}>🌙 Dark</button>
            <button className={`btn ${scheme === 'light' ? 'active' : 'idle'}`} onClick={() => setScheme('light')}>☀️ Light</button>
          </div>
        </div>

        <div className="section">NOTIFICATIONS</div>
        <div className="card">
          <div className="muted" style={{ lineHeight: 1.5 }}>
            The app shows a notification when a warning is active for your location. Background push (even when the
            app is closed) arrives in Phase 3 with a service worker + server.
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={test}>🔔 Send a test notification</button>
          {msg && <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>{msg}</div>}
        </div>

        <div className="section">ABOUT</div>
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 16 }}>Nova Weather</div>
          <div className="muted" style={{ marginTop: 2 }}>v0.1.0 · Phase 1 (PWA MVP)</div>
          <div className="muted" style={{ lineHeight: 1.5, marginTop: 12 }}>
            Data: National Weather Service (alerts &amp; forecast), SPC (outlooks), RainViewer (radar). All free /
            public domain. This app complements — does not replace — a NOAA weather radio and Wireless Emergency Alerts.
          </div>
          <div style={{ marginTop: 12 }}>
            <a href="https://www.weather.gov/" target="_blank" rel="noreferrer">weather.gov ↗</a>
          </div>
        </div>
      </div>
    </div>
  );
}
