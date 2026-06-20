import { useEffect, useRef, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { getActiveAlerts, type NwsAlert } from '../api/nws';
import { useLocations } from '../context/LocationsContext';
import { usePrefs, shouldNotifyAlert } from '../lib/prefs';
import { severityColor } from '../theme/colors';
import { playEasAttention, initAudioUnlock } from '../lib/eas';

const POLL_MS = 90_000; // check for newly issued alerts every 90s

// Higher = more urgent; used to pick which new alert to surface + tone length.
function rank(event: string): number {
  const e = event.toLowerCase();
  if (e.includes('tornado warning')) return 5;
  if (e.includes('severe thunderstorm warning') || e.includes('flash flood warning')) return 4;
  if (e.includes('warning')) return 3;
  if (e.includes('watch')) return 2;
  return 1;
}

// App-wide: watches the selected location for alerts the NWS issues *after* the
// app is open and pops a full-screen box + EAS-style tone for ones the user's
// notification prefs allow. Pre-existing alerts (active at open / on location
// change) are seeded silently so they don't alarm.
export function AlertAlarm() {
  const { selected } = useLocations();
  const { prefs } = usePrefs();
  const [active, setActive] = useState<NwsAlert | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const seeded = useRef(false);
  const stopTone = useRef<(() => void) | null>(null);

  useEffect(() => { initAudioUnlock(); }, []);

  // New location → forget what we'd seen so we don't alarm for its existing alerts.
  useEffect(() => {
    seen.current = new Set();
    seeded.current = false;
  }, [selected.lat, selected.lon]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      let alerts: NwsAlert[];
      try { alerts = await getActiveAlerts(selected.lat, selected.lon); } catch { return; }
      if (cancelled) return;
      if (!seeded.current) {
        alerts.forEach((a) => seen.current.add(a.id));
        seeded.current = true;
        return;
      }
      const fresh = alerts.filter((a) => !seen.current.has(a.id));
      alerts.forEach((a) => seen.current.add(a.id));
      const alarmable = fresh
        .filter((a) => shouldNotifyAlert(a.event, prefs))
        .sort((a, b) => rank(b.event) - rank(a.event));
      if (alarmable.length) {
        const a = alarmable[0];
        stopTone.current?.();
        stopTone.current = playEasAttention(rank(a.event) >= 4 ? 10 : 7);
        setActive(a);
      }
    };
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, [selected.lat, selected.lon, prefs]);

  useEffect(() => () => stopTone.current?.(), []);

  if (!active) return null;
  const c = severityColor(active.severity, active.event);
  const until = active.ends
    ? new Date(active.ends).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
    : '';
  const dismiss = () => { stopTone.current?.(); stopTone.current = null; setActive(null); };

  return (
    <div className="alarm-backdrop" role="alertdialog" aria-label={active.event}>
      <div className="alarm-card" style={{ borderColor: c }}>
        <div className="alarm-head" style={{ background: c }}>
          <TriangleAlert size={20} />
          <span>{active.event}</span>
        </div>
        <div className="alarm-body">
          {active.headline && <div className="alarm-headline">{active.headline}</div>}
          {active.areaDesc && <div className="alarm-area">{active.areaDesc}</div>}
          {until && <div className="alarm-until">In effect until {until}</div>}
          {active.instruction && <div className="alarm-instruction">{active.instruction}</div>}
        </div>
        <button className="btn btn-primary alarm-dismiss" onClick={dismiss}>Silence &amp; dismiss</button>
      </div>
    </div>
  );
}
