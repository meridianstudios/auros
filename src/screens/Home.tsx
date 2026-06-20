import { useEffect, useRef } from 'react';
import { MapPin, ChevronDown, ChevronRight, ShieldCheck, CloudLightning, Zap } from 'lucide-react';
import { useLocations } from '../context/LocationsContext';
import { useWeather } from '../hooks/useWeather';
import { usePrefs, convertTemp, shouldNotifyAlert, isQuietNow } from '../lib/prefs';
import { RiskBadge } from '../components/RiskBadge';
import { AlertCard } from '../components/AlertCard';
import { CondIcon } from '../components/CondIcon';
import { notify } from '../lib/notify';
import { formatTime } from '../utils/format';
import type { View } from '../nav';

// Trim a long geocoder label ("Noble Township, Branch County, MI") to a tidy
// "Noble Township, MI" for the hero. Two-part names are left as-is.
function shortPlace(name: string): string {
  const parts = name.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]}, ${parts[parts.length - 1]}`;
}

export function Home({ onNavigate }: { onNavigate: (v: View) => void }) {
  const { selected } = useLocations();
  const { prefs } = usePrefs();
  const w = useWeather(selected.lat, selected.lon);
  const notified = useRef<Set<string>>(new Set());
  const u = prefs.units;

  // Alert notifications, gated by per-event prefs + quiet hours.
  useEffect(() => {
    w.alerts.forEach((a) => {
      if (!notified.current.has(a.id) && shouldNotifyAlert(a.event, prefs)) {
        notified.current.add(a.id);
        notify(a.event, a.headline ?? selected.name);
      }
    });
  }, [w.alerts, prefs, selected.name]);

  // Storm-approach heads-up (once per detected window).
  useEffect(() => {
    const tl = w.timeline;
    if (!tl || !prefs.notify.stormHeadsUp || isQuietNow(prefs.quiet)) return;
    const key = `tl-${tl.startIso}`;
    if (notified.current.has(key)) return;
    notified.current.add(key);
    notify('Storms expected', `${selected.name}: likely ${formatTime(tl.startIso)}–${formatTime(tl.endIso)}, peak ${tl.peakPop}%`);
  }, [w.timeline, prefs, selected.name]);

  // Show the location the user actually chose. Only GPS-added spots (named the
  // generic "My Location") fall back to the NWS nearest-city.
  const place =
    selected.name === 'My Location' && w.point?.city
      ? `${w.point.city}, ${w.point.state}`
      : shortPlace(selected.name);
  const tl = w.timeline;

  return (
    <div className="view fade home-view">
      <div className="app-header">
        <div className="brand"><Zap size={16} /> Auros</div>
      </div>
      <div className="hero">
        <button className="place" onClick={() => onNavigate('locations')}>
          <MapPin size={14} /> {place} <ChevronDown size={13} style={{ opacity: 0.5 }} />
        </button>
        <div className="hero-row">
          <div>
            <div className="temp">{w.current ? `${convertTemp(w.current.temperature, u)}°` : '—'}</div>
            <div className="cond">{w.current?.shortForecast ?? (w.loading ? 'Updating…' : 'Unavailable')}</div>
          </div>
          {w.current && <span className="hero-ic"><CondIcon p={w.current} size={46} color="var(--primary)" /></span>}
        </div>
        {w.current && (
          <div className="hero-stats">
            <div className="hstat"><span className="hk">Wind</span><span className="hv">{w.current.windDirection} {w.current.windSpeed}</span></div>
            {w.current.probabilityOfPrecipitation?.value != null && (
              <div className="hstat"><span className="hk">Precip</span><span className="hv">{w.current.probabilityOfPrecipitation.value}%</span></div>
            )}
            {w.riskTomorrow && (
              <div className="hstat"><span className="hk">Tomorrow</span><span className="hv">{w.riskTomorrow.full}</span></div>
            )}
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

        {/* Hourly strip — full-width band */}
        {w.hourly.length > 0 && (
          <>
            <div className="label">
              <span>Hourly</span>
              <button className="dim" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, letterSpacing: 0.7 }} onClick={() => onNavigate('forecast')}>
                FULL FORECAST <ChevronRight size={13} />
              </button>
            </div>
            <div className="hourly">
              {w.hourly.slice(0, 12).map((h) => {
                const pop = h.probabilityOfPrecipitation?.value ?? 0;
                return (
                  <div className="hour" key={h.startTime}>
                    <div className="hr">{new Date(h.startTime).toLocaleTimeString([], { hour: 'numeric' })}</div>
                    <CondIcon p={h} size={20} />
                    <div className="hpop">{pop >= 10 ? `${pop}%` : ''}</div>
                    <div className="htemp">{convertTemp(h.temperature, u)}°</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="dash">
          <div className="dash-main">
          {/* Storm-approach timeline — the Phase 2 headline */}
          {tl && (
            <section className="block">
              <div className="label">Storm Timeline</div>
              <div className="card timeline-card">
                <span className="tl-ic"><CloudLightning size={22} /></span>
                <div>
                  <div className="tl-title">
                    {tl.startIso === tl.endIso
                      ? `Storms likely around ${formatTime(tl.startIso)}`
                      : `Storms likely ${formatTime(tl.startIso)} – ${formatTime(tl.endIso)}`}
                  </div>
                  <div className="tl-sub">Peak around {formatTime(tl.peakIso)} · {tl.peakPop}% chance</div>
                </div>
              </div>
            </section>
          )}

          {/* Severe Outlook */}
          <section className="block">
            <div className="label">Severe Outlook</div>
            <div className="card">
              <RiskBadge risk={w.risk} error={w.riskError} />
              {w.riskTomorrow && (
                <div className="muted" style={{ fontSize: 13, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  Tomorrow · <span style={{ color: 'var(--text)' }}>{w.riskTomorrow.full} Risk</span>
                </div>
              )}
            </div>
          </section>

          {/* Active Alerts */}
          <section className="block">
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
          </section>
          </div>

          {w.daily.length > 0 && (
            <div className="dash-side">
              <section className="block">
                <div className="label">7-Day Forecast</div>
                <div className="group">
                  {w.daily.filter((p) => p.isDaytime).slice(0, 7).map((p) => {
                    const pop = p.probabilityOfPrecipitation?.value ?? 0;
                    return (
                      <div className="item" key={p.startTime}>
                        <span className="ic"><CondIcon p={p} size={20} /></span>
                        <div className="grow"><div className="t">{p.name}</div></div>
                        {pop >= 10 && <span className="dim" style={{ fontSize: 12, marginRight: 10 }}>{pop}%</span>}
                        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{convertTemp(p.temperature, u)}°</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
