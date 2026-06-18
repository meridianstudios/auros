import { useEffect, useRef } from 'react';
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
        notify(`⚠️ ${a.event}`, a.headline ?? selected.name);
      }
    });
  }, [w.alerts, selected.name]);

  const place = w.point?.city ? `${w.point.city}, ${w.point.state}` : selected.name;

  return (
    <div className="view">
      <div className="header">
        <div className="brand">⛈️ Nova Weather</div>
        <button className="loc-chip" onClick={() => onNavigate('locations')}>
          📍 {place} ▾
        </button>
      </div>

      <div className="pad">
        {w.error && (
          <div className="card" style={{ borderColor: 'var(--danger)', marginTop: 16 }}>
            <strong style={{ color: 'var(--danger)' }}>{w.error}</strong>
            <div className="muted" style={{ marginTop: 4 }}>Tap refresh below to retry.</div>
            <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={w.refresh}>Retry</button>
          </div>
        )}

        <div className="section">TODAY'S SEVERE OUTLOOK</div>
        <div className="card">
          <RiskBadge risk={w.risk} error={w.riskError} />
          {w.riskTomorrow && (
            <div className="muted" style={{ marginTop: 12 }}>
              Tomorrow: <strong style={{ color: 'var(--text)' }}>{w.riskTomorrow.full}</strong>
            </div>
          )}
        </div>

        <div className="section">NOW</div>
        <div className="card">
          {w.current ? (
            <div className="now">
              <div className="temp">{w.current.temperature}°</div>
              <div>
                <div style={{ fontWeight: 600 }}>{w.current.shortForecast}</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  Wind {w.current.windDirection} {w.current.windSpeed}
                  {w.current.probabilityOfPrecipitation?.value != null
                    ? ` · ${w.current.probabilityOfPrecipitation.value}% precip`
                    : ''}
                </div>
              </div>
            </div>
          ) : w.loading ? (
            <div className="muted">Loading conditions…</div>
          ) : (
            <div className="muted">Conditions unavailable.</div>
          )}
        </div>

        <div className="section">
          <span>ACTIVE ALERTS{w.alerts.length ? ` (${w.alerts.length})` : ''}</span>
          {w.alerts.length > 0 && (
            <span style={{ color: 'var(--primary)', cursor: 'pointer', letterSpacing: 0 }} onClick={() => onNavigate('alerts')}>
              See all
            </span>
          )}
        </div>
        {w.alerts.length === 0 ? (
          <div className="card row" style={{ gap: 10 }}>
            <span style={{ color: 'var(--success)' }}>✓</span>
            <span>No active watches or warnings.</span>
          </div>
        ) : (
          w.alerts.slice(0, 3).map((a) => <AlertCard key={a.id} alert={a} onClick={() => onNavigate('alerts')} />)
        )}
      </div>
    </div>
  );
}
