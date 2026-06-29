import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { MapPin, ChevronDown, ChevronRight, ShieldCheck, CloudLightning, Zap, RotateCw } from 'lucide-react';
import { useLocations } from '../context/LocationsContext';
import { useWeather } from '../hooks/useWeather';
import { useConditions } from '../hooks/useConditions';
import { usePollen } from '../hooks/usePollen';
import { aqiInfo, uvInfo, uvColor } from '../api/conditions';
import { pollenInfo } from '../api/pollen';
import { useTropical } from '../hooks/useTropical';
import { catColor, compass } from '../api/tropical';
import { haversineMiles } from '../utils/geo';
import { usePrefs, convertTemp, isQuietNow } from '../lib/prefs';
import { RiskBadge } from '../components/RiskBadge';
import { AlertCard } from '../components/AlertCard';
import { CondIcon } from '../components/CondIcon';
import { HourlyGraph } from '../components/HourlyGraph';
import { HeroSky } from '../components/HeroSky';
import { useLandmark } from '../api/landmark';
import { SevereBanner } from '../components/SevereBanner';
import type { RiskMeta } from '../theme/colors';
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

// Local "HH:MM" (24h, location's own time) → "6:29 AM".
function fmtClock(iso: string): string {
  const [hh, mm = '00'] = (iso.split('T')[1] ?? '').split(':');
  let h = parseInt(hh, 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mm} ${ap}`;
}

// "Updated 2m ago" relative label.
function ago(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 45) return 'Updated just now';
  if (s < 3600) return `Updated ${Math.round(s / 60)}m ago`;
  return `Updated ${Math.round(s / 3600)}h ago`;
}

function Tile({ k, v, sub, color }: { k: string; v: string; sub?: string; color?: string }) {
  return (
    <div className="ctile">
      <div className="ck">{k}</div>
      <div className="cv" style={color ? { color } : undefined}>{v}</div>
      {sub && <div className="csub">{sub}</div>}
    </div>
  );
}

const SEV_RANK: Record<string, number> = { Extreme: 3, Severe: 2, Moderate: 1, Minor: 0 };
const sevRank = (s?: string) => SEV_RANK[s ?? ''] ?? 0;

// Storm heads-up dedup, kept at module scope so it survives Home unmounting and
// remounting on navigation (a per-component ref would reset and re-notify).
const stormSeen = new Set<string>();

function OutlookRow({ label, risk }: { label: string; risk: RiskMeta }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
      <span className="muted">{label}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: risk.color }} /> {risk.full}
      </span>
    </div>
  );
}

export function Home({ onNavigate }: { onNavigate: (v: View) => void }) {
  const { selected, locations, selectedId, select } = useLocations();
  const { prefs } = usePrefs();
  const w = useWeather(selected.lat, selected.lon);
  const c = useConditions(selected.lat, selected.lon);
  const pollen = usePollen(selected.lat, selected.lon);
  const trop = useTropical();
  const u = prefs.units;
  // Tick so the "updated X ago" label stays current while the app is open.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Watch/warning notifications are handled app-wide by AlertAlarm (it seeds
  // existing alerts and survives navigation, so it won't re-announce). Home only
  // owns the storm-approach heads-up below.

  // Storm-approach heads-up (once per detected window).
  useEffect(() => {
    const tl = w.timeline;
    if (!tl || !prefs.notify.stormHeadsUp || isQuietNow(prefs.quiet)) return;
    const key = `tl-${selected.name}-${tl.startIso}`;
    if (stormSeen.has(key)) return;
    stormSeen.add(key);
    notify('Storms expected', `${selected.name}: likely ${formatTime(tl.startIso)} to ${formatTime(tl.endIso)}, peak ${tl.peakPop}%`);
  }, [w.timeline, prefs, selected.name]);

  // Show the location the user actually chose. Only GPS-added spots (named the
  // generic "My Location") fall back to the NWS nearest-city.
  const place =
    selected.name === 'My Location' && w.point?.city
      ? `${w.point.city}, ${w.point.state}`
      : shortPlace(selected.name);
  const heroImg = useLandmark(place); // city photo backdrop, null for addresses/townships
  const tl = w.timeline;
  const day3Label = new Date(Date.now() + 2 * 86400000).toLocaleDateString([], { weekday: 'long' });
  const isDay = c ? c.isDay : true;
  const warning = [...w.alerts].filter((a) => /warning/i.test(a.event)).sort((a, b) => sevRank(b.severity) - sevRank(a.severity))[0];
  const storms = (trop?.storms ?? [])
    .map((s) => ({ ...s, dist: haversineMiles(selected.lat, selected.lon, s.lat, s.lon) }))
    .sort((a, b) => a.dist - b.dist);

  // Swipe the hero to cycle locations: the content tracks your finger and the
  // destination peeks in, then it commits (slide-in) or springs back. Natural
  // carousel physics — drag left reveals the next, drag right the previous.
  const [animDir, setAnimDir] = useState<'l' | 'r'>('r');
  const heroContentRef = useRef<HTMLDivElement>(null);
  const peekNextRef = useRef<HTMLDivElement>(null);
  const peekPrevRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const axisRef = useRef<'?' | 'x' | 'y'>('?');
  const dragXRef = useRef(0);

  const curIdx = locations.findIndex((l) => l.id === selectedId);
  const nextLoc = locations.length > 1 ? locations[(curIdx + 1) % locations.length] : null;
  const prevLoc = locations.length > 1 ? locations[(curIdx - 1 + locations.length) % locations.length] : null;

  // Paint the live drag straight to the DOM (no re-render) so it tracks at 60fps.
  const paintDrag = (x: number) => {
    dragXRef.current = x;
    if (heroContentRef.current) heroContentRef.current.style.transform = x ? `translateX(${x}px)` : '';
    const ramp = String(Math.min(1, Math.abs(x) / 110));
    if (peekNextRef.current) peekNextRef.current.style.opacity = x < -8 ? ramp : '0';
    if (peekPrevRef.current) peekPrevRef.current.style.opacity = x > 8 ? ramp : '0';
  };

  const cycle = (forward: boolean) => {
    if (locations.length < 2) return;
    setAnimDir(forward ? 'r' : 'l');
    select(locations[(curIdx + (forward ? 1 : -1) + locations.length) % locations.length].id);
  };

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
    axisRef.current = '?';
    if (heroContentRef.current) heroContentRef.current.style.transition = 'none';
  };
  const onTouchMove = (e: TouchEvent) => {
    const s = startRef.current;
    if (!s || locations.length < 2) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // Lock the axis on first move so we don't fight vertical scroll.
    if (axisRef.current === '?' && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (axisRef.current === 'x') { e.preventDefault(); paintDrag(dx); }
  };
  const onTouchEnd = () => {
    const s = startRef.current;
    const x = dragXRef.current;
    startRef.current = null;
    if (peekNextRef.current) peekNextRef.current.style.opacity = '0';
    if (peekPrevRef.current) peekPrevRef.current.style.opacity = '0';
    if (s && axisRef.current === 'x' && Math.abs(x) > 60) {
      cycle(x < 0); // dragged far enough → switch (the new content slides in)
    } else if (heroContentRef.current) {
      // Not far enough → spring back to center.
      heroContentRef.current.style.transition = 'transform 0.24s cubic-bezier(0.22,0.61,0.36,1)';
      heroContentRef.current.style.transform = '';
    }
    dragXRef.current = 0;
  };

  // Desktop: Alt + Left/Right arrows cycle locations (matches the swipe).
  useEffect(() => {
    if (locations.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); cycle(true); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); cycle(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, selectedId]);

  return (
    <div className="view fade home-view">
      <div className="app-header">
        <div className="brand"><Zap size={16} /> Auros</div>
      </div>
      <div className={`hero${heroImg ? ' has-photo' : ''}`} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {heroImg
          ? <div className="hero-photo" style={{ backgroundImage: `url("${heroImg}")` }} />
          : <HeroSky condition={w.current?.shortForecast} day={isDay} sunrise={c?.sunrise} sunset={c?.sunset} now={c?.localTime} />}
        {nextLoc && <div className="hero-peek hero-peek-next" ref={peekNextRef}>{shortPlace(nextLoc.name)} <MapPin size={13} /></div>}
        {prevLoc && <div className="hero-peek hero-peek-prev" ref={peekPrevRef}><MapPin size={13} /> {shortPlace(prevLoc.name)}</div>}
        <div className={`hero-content hero-anim-${animDir}`} key={selectedId} ref={heroContentRef}>
          <div className="hero-top">
            <button className="place" onClick={() => onNavigate('locations')}>
              <MapPin size={14} /> {place} <ChevronDown size={13} style={{ opacity: 0.5 }} />
            </button>
            {w.updatedAt && (
              <button className="refresh-btn" onClick={() => w.refresh()} aria-label="Refresh">
                {ago(w.updatedAt)} <RotateCw size={12} />
              </button>
            )}
          </div>
          <div className="hero-row">
            <div>
              <div className="temp">{w.current ? `${convertTemp(w.current.temperature, u)}°` : w.error ? '—' : <span className="skel skel-temp" />}</div>
              <div className="cond">{w.current?.shortForecast ?? (w.error ? 'Unavailable' : <span className="skel skel-cond" />)}</div>
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
        {locations.length > 1 && (
          <div className="hero-dots">
            {locations.map((l) => (
              <button
                key={l.id}
                className={`hero-dot${l.id === selectedId ? ' on' : ''}`}
                aria-label={`Show ${l.name}`}
                onClick={() => { setAnimDir('r'); select(l.id); }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="pad pad-swap" key={selectedId}>
        {warning && <SevereBanner alert={warning} onNavigate={onNavigate} />}
        {storms.length > 0 && (
          <>
            <div className="label">Active Tropical Systems</div>
            {storms.map((s) => (
              <div key={s.name} className="card" style={{ display: 'flex', gap: 12 }}>
                <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 3, background: catColor(s.category), flex: 'none' }} />
                <div className="grow">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                    <span style={{ color: catColor(s.category), fontWeight: 700, fontSize: 13 }}>{s.category}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                    {s.type}{s.maxWindMph != null ? ` · ${s.maxWindMph} mph winds` : ''}{s.pressure != null ? ` · ${s.pressure} mb` : ''}
                  </div>
                  <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>
                    {s.moveDir != null ? `Moving ${compass(s.moveDir)}${s.moveSpeedMph != null ? ` at ${s.moveSpeedMph} mph` : ''} · ` : ''}{Math.round(s.dist)} mi away
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {w.error && (
          <>
            <div className="label">Connection</div>
            <div className="card">
              <div className="muted">{w.error}</div>
              <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={w.refresh}>Retry</button>
            </div>
          </>
        )}

        {/* Hourly forecast — icons + per-hour temps + temperature curve */}
        {w.hourly.length > 0 ? (
          <>
            <div className="label">
              <span>Hourly Forecast</span>
              <button className="dim" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, letterSpacing: 0.7 }} onClick={() => onNavigate('forecast')}>
                FULL FORECAST <ChevronRight size={13} />
              </button>
            </div>
            <HourlyGraph hourly={w.hourly} units={u} />
          </>
        ) : w.loading && !w.error ? (
          <>
            <div className="label"><span>Hourly Forecast</span></div>
            <div className="card skel" style={{ height: 130 }} />
          </>
        ) : null}

        {(c || w.loading) && (
          <>
            <div className="label">Conditions</div>
            {!c ? (
              <div className="cond-grid">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skel skel-tile" />)}
              </div>
            ) : (
            <div className="cond-grid sec-in">
              {c.feelsLikeF != null && <Tile k="Feels like" v={`${convertTemp(c.feelsLikeF, u)}°`} />}
              {c.humidity != null && <Tile k="Humidity" v={`${c.humidity}%`} />}
              {c.dewpointF != null && <Tile k="Dew point" v={`${convertTemp(c.dewpointF, u)}°`} />}
              {c.gustMph != null && <Tile k="Wind gust" v={u === 'C' ? `${Math.round(c.gustMph * 1.609)} km/h` : `${Math.round(c.gustMph)} mph`} />}
              {c.uv != null && <Tile k="UV index" v={`${Math.round(c.uv)}`} sub={uvInfo(c.uv)} color={uvColor(c.uv)} />}
              {c.aqi != null && <Tile k="Air quality" v={`${c.aqi}`} sub={aqiInfo(c.aqi).label} color={aqiInfo(c.aqi).color} />}
              {pollen && <Tile k="Pollen" v={pollenInfo(pollen.index).label} sub={pollen.triggers.join(', ') || undefined} color={pollenInfo(pollen.index).color} />}
              {c.pressureHpa != null && <Tile k="Pressure" v={u === 'C' ? `${Math.round(c.pressureHpa)} hPa` : `${(c.pressureHpa * 0.02953).toFixed(2)} in`} />}
              {c.visibilityM != null && <Tile k="Visibility" v={u === 'C' ? `${Math.round(c.visibilityM / 1000)} km` : `${Math.round(c.visibilityM / 1609)} mi`} />}
              {c.sunrise && <Tile k="Sunrise" v={fmtClock(c.sunrise)} />}
              {c.sunset && <Tile k="Sunset" v={fmtClock(c.sunset)} />}
            </div>
            )}
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
              {(w.riskTomorrow || w.riskDay3) && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {w.riskTomorrow && <OutlookRow label="Tomorrow" risk={w.riskTomorrow} />}
                  {w.riskDay3 && <OutlookRow label={day3Label} risk={w.riskDay3} />}
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
            {w.loading && w.alerts.length === 0 ? (
              <div className="group">
                <div className="item"><span className="skel skel-row" /></div>
              </div>
            ) : w.alerts.length === 0 ? (
              <div className="group sec-in">
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

          {(w.daily.length > 0 || w.loading) && (
            <div className="dash-side">
              <section className="block">
                <div className="label">7-Day Forecast</div>
                {w.daily.length === 0 ? (
                  <div className="group">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div className="item" key={i}><span className="skel skel-row" /></div>
                    ))}
                  </div>
                ) : (
                <div className="group sec-in">
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
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
