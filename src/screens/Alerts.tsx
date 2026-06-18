import { useState } from 'react';
import { ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { useLocations } from '../context/LocationsContext';
import { useWeather } from '../hooks/useWeather';
import { severityColor } from '../theme/colors';
import { formatDayTime } from '../utils/format';

export function Alerts() {
  const { selected } = useLocations();
  const w = useWeather(selected.lat, selected.lon);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="view fade">
      <div className="topbar">
        <h1>Alerts</h1>
        <p>{selected.name}</p>
      </div>
      <div className="pad">
        {w.loading && w.alerts.length === 0 ? (
          <div className="center"><div className="spin" /></div>
        ) : w.alerts.length === 0 ? (
          <div className="group">
            <div className="item">
              <span className="ic" style={{ color: 'var(--success)' }}><ShieldCheck size={20} /></span>
              <div className="grow">
                <div className="t">All clear</div>
                <div className="s">No watches, warnings, or advisories for {selected.name}.</div>
              </div>
            </div>
          </div>
        ) : (
          w.alerts.map((a) => {
            const accent = severityColor(a.severity, a.event);
            const isOpen = open === a.id;
            return (
              <button
                key={a.id}
                className="card"
                style={{ display: 'flex', gap: 14, width: '100%', textAlign: 'left', alignItems: 'flex-start' }}
                onClick={() => setOpen(isOpen ? null : a.id)}
              >
                <div className="alert-accent" style={{ background: accent }} />
                <div className="grow">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: accent }}>{a.event}</span>
                    {isOpen ? <ChevronUp size={17} className="chev" /> : <ChevronDown size={17} className="chev" />}
                  </div>
                  {a.headline && <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>{a.headline}</div>}
                  <div className="dim" style={{ fontSize: 12, marginTop: 6 }}>
                    {a.areaDesc}{a.ends ? ` · until ${formatDayTime(a.ends)}` : ''}
                  </div>
                  {isOpen && (
                    <div className="alert-body">
                      {a.description?.trim()}
                      {a.instruction ? `\n\n${a.instruction.trim()}` : ''}
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
        <div className="dim" style={{ textAlign: 'center', fontSize: 11, marginTop: 14 }}>
          National Weather Service · api.weather.gov
        </div>
      </div>
    </div>
  );
}
