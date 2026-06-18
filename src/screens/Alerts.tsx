import { useState } from 'react';
import { useLocations } from '../context/LocationsContext';
import { useWeather } from '../hooks/useWeather';
import { severityColor } from '../theme/colors';
import { formatDayTime } from '../utils/format';

export function Alerts() {
  const { selected } = useLocations();
  const w = useWeather(selected.lat, selected.lon);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="view">
      <div className="bar">
        <h1>Active Alerts</h1>
        <p>{selected.name}</p>
      </div>
      <div className="pad" style={{ paddingTop: 12 }}>
        {w.loading && w.alerts.length === 0 ? (
          <div className="center" style={{ height: 120 }}><div className="spin" /></div>
        ) : w.alerts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '28px 16px' }}>
            <div style={{ fontSize: 40 }}>🛡️</div>
            <div style={{ fontWeight: 700, marginTop: 10, fontSize: 16 }}>No active alerts</div>
            <div className="muted" style={{ marginTop: 4 }}>No watches, warnings, or advisories for {selected.name}.</div>
          </div>
        ) : (
          w.alerts.map((a) => {
            const accent = severityColor(a.severity, a.event);
            const isOpen = open === a.id;
            return (
              <div key={a.id} className="card alert" style={{ borderLeftColor: accent, cursor: 'pointer' }} onClick={() => setOpen(isOpen ? null : a.id)}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="ev" style={{ color: accent }}>{a.event}</span>
                  <span className="muted">{isOpen ? '▲' : '▼'}</span>
                </div>
                {a.headline && <div style={{ marginTop: 6 }}>{a.headline}</div>}
                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{a.areaDesc}</div>
                {a.ends && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Expires {formatDayTime(a.ends)}</div>}
                {isOpen && (
                  <div className="body">
                    {a.description?.trim()}
                    {a.instruction ? `\n\n${a.instruction.trim()}` : ''}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div className="muted" style={{ textAlign: 'center', fontSize: 11, marginTop: 8 }}>
          Source: National Weather Service (api.weather.gov)
        </div>
      </div>
    </div>
  );
}
