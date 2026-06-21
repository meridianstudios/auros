import { useState } from 'react';
import { Moon, Sun, Bell, ExternalLink, Siren } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { usePrefs, type NotifyPrefs } from '../lib/prefs';
import { notify } from '../lib/notify';
import { isNative } from '../lib/platform';

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="knob" />
    </button>
  );
}

const hourLabel = (h: number) => new Date(2020, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' });

const NOTIFY_ROWS: { key: keyof NotifyPrefs; label: string; sub: string }[] = [
  { key: 'tornado', label: 'Tornado warnings', sub: 'Always alerts, even during quiet hours' },
  { key: 'severe', label: 'Severe & flash-flood warnings', sub: 'Severe thunderstorm, flash flood' },
  { key: 'watches', label: 'Watches', sub: 'Tornado & severe thunderstorm watches' },
  { key: 'advisories', label: 'Advisories & statements', sub: 'Wind, flood, etc.' },
  { key: 'stormHeadsUp', label: 'Storm heads-up', sub: 'Timeline notice when storms approach' },
  { key: 'alarmSound', label: 'Alarm sound', sub: 'Play the EAS tone with the on-screen alert box' },
];

export function Settings() {
  const { scheme, setScheme } = useTheme();
  const { prefs, setUnits, setNotify, setQuiet } = usePrefs();
  const [msg, setMsg] = useState<string | null>(null);

  const test = async () => {
    const ok = await notify('Auros test', 'Notifications are working.');
    const blocked = isNative
      ? 'Blocked — enable Auros in Windows notification settings.'
      : 'Blocked — enable notifications in your browser/site settings.';
    setMsg(ok ? 'Sent — check your notifications.' : blocked);
  };

  return (
    <div className="view fade">
      <div className="topbar"><h1>Settings</h1></div>
      <div className="pad">
        <div className="label">Appearance</div>
        <div className="seg" style={{ marginBottom: 10 }}>
          <button className={scheme === 'dark' ? 'on' : ''} onClick={() => setScheme('dark')}><Moon size={15} /> Dark</button>
          <button className={scheme === 'light' ? 'on' : ''} onClick={() => setScheme('light')}><Sun size={15} /> Light</button>
        </div>
        <div className="seg">
          <button className={prefs.units === 'F' ? 'on' : ''} onClick={() => setUnits('F')}>°F</button>
          <button className={prefs.units === 'C' ? 'on' : ''} onClick={() => setUnits('C')}>°C</button>
        </div>

        <div className="label">Notify me about</div>
        <div className="group">
          {NOTIFY_ROWS.map((r) => (
            <div className="item" key={r.key}>
              <div className="grow">
                <div className="t">{r.label}</div>
                <div className="s">{r.sub}</div>
              </div>
              <Toggle on={prefs.notify[r.key]} onChange={(v) => setNotify(r.key, v)} />
            </div>
          ))}
        </div>

        <div className="label">Quiet hours</div>
        <div className="group">
          <div className="item">
            <div className="grow">
              <div className="t">Silence non-tornado alerts</div>
              <div className="s">Tornado warnings still come through</div>
            </div>
            <Toggle on={prefs.quiet.enabled} onChange={(v) => setQuiet({ enabled: v })} />
          </div>
          {prefs.quiet.enabled && (
            <div className="item">
              <div className="grow"><div className="t">From</div></div>
              <select className="hsel" value={prefs.quiet.start} onChange={(e) => setQuiet({ start: Number(e.target.value) })}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
              <span className="dim" style={{ margin: '0 4px' }}>to</span>
              <select className="hsel" value={prefs.quiet.end} onChange={(e) => setQuiet({ end: Number(e.target.value) })}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="label">Notifications</div>
        <div className="card">
          <div className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
            Notifications fire while the app is open{isNative ? ' — as native Windows alerts' : ''}. Background
            alerts when it&rsquo;s closed are coming in a later update.
          </div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={test}><Bell size={16} /> Send a test notification</button>
          {msg && <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>{msg}</div>}
          <button
            className="btn btn-ghost"
            style={{ marginTop: 10, width: '100%' }}
            onClick={() => window.dispatchEvent(new CustomEvent('auros:test-alarm'))}
          >
            <Siren size={16} /> Test the alert alarm (box + sound)
          </button>
          <div className="dim" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
            Plays the EAS-style tone and shows the alert box, as if a new warning were issued.
          </div>
        </div>

        <div className="label">About</div>
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 17 }}>Auros</div>
          <div className="dim" style={{ fontSize: 13, marginTop: 2 }}>v{__APP_VERSION__} · by Meridian</div>
          <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 12 }}>
            Data from the National Weather Service, SPC, and RainViewer — all free and public domain. Complements,
            does not replace, a NOAA weather radio and Wireless Emergency Alerts.
          </div>
          <a href="https://www.weather.gov/" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, fontWeight: 600, fontSize: 14 }}>
            weather.gov <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
