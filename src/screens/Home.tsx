import { useEffect, useRef } from 'react';
import { MapPin, ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import { useLocations } from '../context/LocationsContext';
import { useWeather } from '../hooks/useWeather';
import { RiskBadge } from '../components/RiskBadge';
import { AlertCard } from '../components/AlertCard';
import { notify } from '../lib/notify';
import type { View } from '../nav';

export function Home({ onNavigate }: { onNavigate: (v: View) => void }) {
  const { selected } = useLocations();
  const w = useWeather(selected.lat, selected.lon);
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    w.alerts.forEach((a) => {
      if (/warning/i.test(a.event) && !notified.current.has(a.id)) {
        notified.current.add(a.id);
        notify(`${a.event}`, a.headline ?? selected.name);
      }
    });
  }, [w.alerts, selected.name]);

  const place = w.point?.city ? `${w.point.city}, ${w.point.state}` : selected.name;

  return (
    <div className="view fade">
      <div className="hero">
        <button className="place" onClick={() => onNavigate('locations')}>
          <MapPin size={15} /> {place} <ChevronDown size={14} style={{ opacity: 0.5 }} />
        </button>
        <div className="temp">{w.current ? `${w.current.temperature}°` : '—'}</div>
        <div className="cond">{w.current?.shortForecast ?? (w.loading ? 'Updating…' : 'Unavailable')}</div>
        {w.current && (
          <div className="meta">
            Wind {w.current.windDirection} {w.current.windSpeed}
            {w.current.probabilityOfPrecipitation?.value != null
              ? `  ·  ${w.current.probabilityOfPrecipitation.value}% precip`
              : ''}
          </div>
        )}
      </div>

      <div className="pad">
        {w.error && (
          <>
            <div className="label">Connection</div>
            <div className="card">
              <div className="muted">{w.error}</div>
              <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={w.refresh}>Retry</button>
            </div>
          </>
        )}

        <div className="label">Severe Outlook</div>
        <div className="card">
          <RiskBadge risk={w.risk} error={w.riskError} />
          {w.riskTomorrow && (
            <div className="muted" style={{ fontSize: 13, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              Tomorrow · <span style={{ color: 'var(--text)' }}>{w.riskTomorrow.full}</span>
            </div>
          )}
        </div>

        <div className="label">
          <span>Active Alerts{w.alerts.length ? ` · ${w.alerts.length}` : ''}</span>
          {w.alerts.length > 0 && (
            <button className="dim" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, letterSpacing: 0.7 }} onClick={() => onNavigate('alerts')}>
              SEE ALL <ChevronRight size={13} />
            </button>
          )}
        </div>
        {w.alerts.length === 0 ? (
          <div className="group">
            <div className="item">
              <span className="ic" style={{ color: 'var(--success)' }}><ShieldCheck size={19} /></span>
              <div className="grow">
                <div className="t">All clear</div>
                <div className="s">No watches, warnings, or advisories.</div>
              </div>
            </div>
          </div>
        ) : (
          w.alerts.slice(0, 3).map((a) => <AlertCard key={a.id} alert={a} onClick={() => onNavigate('alerts')} />)
        )}
      </div>
    </div>
  );
}
