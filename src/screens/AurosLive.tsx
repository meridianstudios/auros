import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Pause, Play, Volume2, VolumeX, SkipForward, Zap, MapPin, ChevronDown, Droplets, Wind, Gauge, Eye, Sunrise, Sunset, Umbrella, Thermometer, Leaf, TriangleAlert } from 'lucide-react';
import { useLocations } from '../context/LocationsContext';
import { useWeather } from '../hooks/useWeather';
import { useConditions } from '../hooks/useConditions';
import { usePollen } from '../hooks/usePollen';
import { aqiInfo, uvInfo, uvColor } from '../api/conditions';
import { pollenInfo } from '../api/pollen';
import { usePrefs, convertTemp } from '../lib/prefs';
import { CondIcon } from '../components/CondIcon';
import { severityColor } from '../theme/colors';
import type { NwsPeriod } from '../api/nws';
import './AurosLive.css';

// Auros Live — a continuous, Weatherscan-style local weather broadcast in the
// Auros look: a persistent "now" rail, a main stage that auto-rotates through
// panels (incl. a live radar), a scrolling NOW/alert crawl, optional looping
// music, and a full-screen severe-weather break-in when a warning is active.

type PanelKey = 'now' | 'hourly' | 'radar' | 'extended' | 'almanac';
const PANELS: { key: PanelKey; title: string }[] = [
  { key: 'now', title: 'Current Conditions' },
  { key: 'hourly', title: 'Hourly Forecast' },
  { key: 'radar', title: 'Local Radar' },
  { key: 'extended', title: 'Extended Forecast' },
  { key: 'almanac', title: 'Sun & Air' },
];
const PANEL_MS = 12_000;

const IEM = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';
const WWA_EXPORT = 'https://mapservices.weather.noaa.gov/eventdriven/rest/services/WWA/watch_warn_adv/MapServer/export';
const WWA_LAYERDEFS = encodeURIComponent("{\"1\":\"prod_type LIKE '%Warning%'\"}");
const WORLD_M = 20037508.342789244;
const TRANSPARENT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/QBYAAAAAElFTkSuQmCC';

// Open-Meteo WMO current-weather code → short label (for the multi-location crawl).
const WMO: Record<number, string> = {
  0: 'Clear', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Cloudy', 45: 'Fog', 48: 'Fog',
  51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle', 56: 'Freezing Drizzle', 57: 'Freezing Drizzle',
  61: 'Rain', 63: 'Rain', 65: 'Heavy Rain', 66: 'Freezing Rain', 67: 'Freezing Rain',
  71: 'Snow', 73: 'Snow', 75: 'Heavy Snow', 77: 'Snow', 80: 'Showers', 81: 'Showers', 82: 'Heavy Showers',
  85: 'Snow Showers', 86: 'Snow Showers', 95: 'Thunderstorms', 96: 'Thunderstorms', 99: 'Thunderstorms',
};
const wmoLabel = (c?: number) => (c == null ? '' : WMO[c] ?? '');

const shortPlace = (n: string) => {
  const p = n.split(',').map((s) => s.trim()).filter(Boolean);
  return p.length <= 2 ? n : `${p[0]}, ${p[p.length - 1]}`;
};
const fmtHour = (iso: string) => {
  const t = iso.split('T')[1] ?? '';
  let h = parseInt(t.slice(0, 2), 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h} ${ap}`;
};
const fmtClockTime = (iso: string) => {
  const [hh, mm = '00'] = (iso.split('T')[1] ?? '').split(':');
  let h = parseInt(hh, 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mm} ${ap}`;
};
const shuffle = (a: string[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

// Non-interactive regional radar for the broadcast: base + NEXRAD reflectivity +
// the official warnings overlay + the location marker. Mounts/tears down with the
// radar panel.
function LiveRadar({ lat, lon }: { lat: number; lon: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const map = L.map(el, {
      zoomControl: false, attributionControl: false, dragging: false,
      scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false,
    }).setView([lat, lon], 7);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 16 }).addTo(map);
    L.tileLayer(`${IEM}/nexrad-n0q-900913/{z}/{x}/{y}.png`, { opacity: 0.72, zIndex: 5, errorTileUrl: TRANSPARENT }).addTo(map);
    const wwa = L.tileLayer('', { opacity: 0.5, zIndex: 6, errorTileUrl: TRANSPARENT });
    (wwa as unknown as { getTileUrl: (c: L.Coords) => string }).getTileUrl = (coords: L.Coords) => {
      const sz = (2 * WORLD_M) / 2 ** coords.z;
      const xmin = -WORLD_M + coords.x * sz;
      const ymax = WORLD_M - coords.y * sz;
      const ts = wwa.getTileSize();
      return `${WWA_EXPORT}?bbox=${xmin},${ymax - sz},${xmin + sz},${ymax}&bboxSR=3857&imageSR=3857&size=${ts.x},${ts.y}&dpi=96&format=png32&transparent=true&layers=show:1&layerDefs=${WWA_LAYERDEFS}&f=image`;
    };
    wwa.addTo(map);
    L.circleMarker([lat, lon], { radius: 6, color: '#fff', weight: 2.5, fillColor: '#6E8BFF', fillOpacity: 1 }).addTo(map);
    const t = setTimeout(() => map.invalidateSize(), 140);
    return () => { clearTimeout(t); map.remove(); };
  }, [lat, lon]);
  return <div className="live-radar" ref={ref} />;
}

function Stat({ icon, k, v, sub, color, i = 0 }: { icon: ReactNode; k: string; v: string; sub?: string; color?: string; i?: number }) {
  return (
    <div className="live-stat" style={{ animationDelay: `${i * 45}ms` }}>
      <span className="live-stat-ic">{icon}</span>
      <div className="live-stat-k">{k}</div>
      <div className="live-stat-v" style={color ? { color } : undefined}>{v}</div>
      {sub && <div className="live-stat-sub">{sub}</div>}
    </div>
  );
}

export function AurosLive({ onExit }: { onExit: () => void }) {
  const { selected, locations, selectedId, select } = useLocations();
  const [locOpen, setLocOpen] = useState(false);
  const w = useWeather(selected.lat, selected.lon);
  const c = useConditions(selected.lat, selected.lon);
  const pollen = usePollen(selected.lat, selected.lon);
  const { prefs } = usePrefs();
  const u = prefs.units;
  const t = (f?: number | null) => (f == null ? '--' : `${convertTemp(f, u)}°`);

  // Live clock
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Severe-weather break-in: any active Severe/Extreme warning takes over the
  // stage and pauses the rotation until it clears.
  const breakInAlert = w.alerts
    .filter((a) => /warning/i.test(a.event) && /extreme|severe/i.test(a.severity || ''))
    .sort((a, b) => (/tornado/i.test(b.event) ? 1 : 0) - (/tornado/i.test(a.event) ? 1 : 0))[0] || null;
  const breakIn = Boolean(breakInAlert);

  // Panel rotation. During a warning the stage keeps cycling (the crawl carries
  // the alert detail); the severe-alert panel is just inserted into the loop so
  // it still gets its own full-screen moment each cycle.
  const activePanels = breakIn ? [{ key: 'alert', title: 'Severe Weather Alert' }, ...PANELS] : PANELS;
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIdx((i) => i + 1), PANEL_MS);
    return () => clearInterval(id);
  }, [paused]);
  useEffect(() => { if (breakIn) setIdx(0); }, [breakIn]); // surface the alert first when it fires
  const advance = () => setIdx((i) => i + 1);
  const active = activePanels[idx % activePanels.length];
  const panel = active.key;
  const title = active.title;

  // Live multi-location NOW readout for the crawl (Open-Meteo current per saved place).
  const [savedNow, setSavedNow] = useState<{ name: string; temp: number | null; label: string }[]>([]);
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((x) => x + 1), 600_000); // refresh the NOW crawl every 10 min
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    let live = true;
    Promise.all(
      locations.map(async (l) => {
        try {
          const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${l.lat}&longitude=${l.lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`);
          const d = await r.json();
          return { name: shortPlace(l.name), temp: typeof d.current?.temperature_2m === 'number' ? d.current.temperature_2m : null, label: wmoLabel(d.current?.weather_code) };
        } catch {
          return null;
        }
      })
    ).then((arr) => { if (live) setSavedNow(arr.filter(Boolean) as { name: string; temp: number | null; label: string }[]); });
    return () => { live = false; };
  }, [locations, nowTick]);

  // Background music (from public/live-music/tracks.json)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackPos = useRef(0);
  const [tracks, setTracks] = useState<string[]>([]);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    let live = true;
    fetch('/live-music/tracks.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => { if (live && Array.isArray(list) && list.length) setTracks(shuffle(list.filter((x) => typeof x === 'string'))); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!tracks.length) return;
    const a = new Audio();
    audioRef.current = a;
    a.volume = 0.5;
    const playAt = (i: number) => { a.src = `/live-music/${encodeURIComponent(tracks[i % tracks.length])}`; a.play().catch(() => {}); };
    const onEnded = () => { trackPos.current = (trackPos.current + 1) % tracks.length; playAt(trackPos.current); };
    a.addEventListener('ended', onEnded);
    playAt(0);
    return () => { a.removeEventListener('ended', onEnded); a.pause(); a.src = ''; audioRef.current = null; };
  }, [tracks]);
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = muted;
    a.volume = breakIn ? 0.08 : 0.5; // duck hard under a break-in — safety over ambiance
    if (!muted && a.paused && tracks.length) a.play().catch(() => {});
  }, [muted, breakIn, tracks]);

  // Esc exits
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  const place = shortPlace(selected.name === 'My Location' && w.point?.city ? `${w.point.city}, ${w.point.state}` : selected.name);
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const cur = w.current;

  const days = useMemo(() => {
    const out: { label: string; p: NwsPeriod; hi: number; lo: number | null; pop: number }[] = [];
    for (let i = 0; i < w.daily.length && out.length < 6; i++) {
      const p = w.daily[i];
      if (!p.isDaytime) continue;
      const night = w.daily[i + 1] && !w.daily[i + 1].isDaytime ? w.daily[i + 1] : null;
      out.push({
        label: new Date(p.startTime).toLocaleDateString([], { weekday: 'short' }),
        p, hi: p.temperature, lo: night ? night.temperature : null,
        pop: p.probabilityOfPrecipitation?.value ?? 0,
      });
    }
    return out;
  }, [w.daily]);

  const sevColor = breakInAlert ? severityColor(breakInAlert.severity, breakInAlert.event) : 'var(--live-red)';
  const breakUntil = breakInAlert?.ends
    ? new Date(breakInAlert.ends).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
    : '';

  // Crawl: the most severe active alert (colored tag + full NWS message), or a
  // rich rotating NOW readout — conditions per saved place, extra details, and a
  // "brought to you by Meridian" segment.
  const flat = (s?: string) => (s || '').replace(/\s+/g, ' ').trim();
  const rankEvent = (e: string) => {
    const s = e.toLowerCase();
    if (s.includes('tornado warning')) return 6;
    if (s.includes('flash flood warning') || s.includes('severe thunderstorm warning')) return 5;
    if (s.includes('warning')) return 4;
    if (s.includes('watch')) return 3;
    if (s.includes('advisory')) return 2;
    return 1;
  };
  const topAlert = [...w.alerts].sort((a, b) => rankEvent(b.event) - rankEvent(a.event))[0] || null;
  // Keep the NOW crawl short + punchy so it reads easily at the larger font —
  // just the headline conditions, not every stat (those live in the panels).
  const nowSegs: string[] = [];
  savedNow.forEach((s) => nowSegs.push(`${s.name}  ${s.temp != null ? `${convertTemp(s.temp, u)}°` : '--'}${s.label ? `  ${s.label}` : ''}`));
  if (c?.feelsLikeF != null) nowSegs.push(`Feels like ${t(c.feelsLikeF)}`);
  if (days[0]) nowSegs.push(`Today ${t(days[0].hi)}${days[0].lo != null ? `, Tonight ${t(days[0].lo)}` : ''}`);
  if (cur) nowSegs.push(`Wind ${cur.windDirection} ${cur.windSpeed}`);
  if (c?.uv != null) nowSegs.push(`UV Index ${Math.round(c.uv)}, ${uvInfo(c.uv)}`);
  nowSegs.push('Brought to you by Meridian');
  const nowText = nowSegs.join('        •        ') || `Auros Live — ${place}`;
  const alertText = topAlert
    ? flat(`${topAlert.event} for ${topAlert.areaDesc}.  ${topAlert.description || topAlert.headline || ''}  ${topAlert.instruction || ''}`)
    : '';
  const crawlText = topAlert ? alertText : nowText;
  // Scroll speed scales with length → consistent, readable pace. Alerts scroll
  // slower (critical wording you want time to read).
  const crawlDur = `${Math.max(topAlert ? 48 : 28, Math.round(crawlText.length * (topAlert ? 0.3 : 0.2)))}s`;
  const crawlTag = topAlert ? topAlert.event : 'NOW';
  const crawlClass = topAlert ? (/warning/i.test(topAlert.event) ? 'warn' : 'watch') : '';
  const tagStyle: CSSProperties | undefined = topAlert ? { background: severityColor(topAlert.severity, topAlert.event) } : undefined;

  return (
    <div className={`live${breakIn ? ' live--alert' : ''}`} role="region" aria-label="Auros Live">
      {/* Left "now" rail */}
      <aside className="live-rail">
        <div className="live-brand"><Zap size={18} /> Auros <span className="live-badge">LIVE</span></div>
        <div className="live-clock">
          <div className="live-date">{dateStr}</div>
          <div className="live-time">{timeStr}</div>
        </div>
        <div className="live-loc-wrap">
          <button className="live-loc" onClick={() => setLocOpen((o) => !o)} aria-label="Change location">
            <MapPin size={15} /> {place}{locations.length > 1 && <ChevronDown size={14} style={{ opacity: 0.6 }} />}
          </button>
          {locOpen && (
            <div className="live-loc-menu">
              {locations.map((l) => (
                <button
                  key={l.id}
                  className={`live-loc-opt${l.id === selectedId ? ' on' : ''}`}
                  onClick={() => { select(l.id); setLocOpen(false); }}
                >
                  {shortPlace(l.name)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="live-now">
          <div className="live-now-label">NOW</div>
          <div className="live-now-main">
            <span className="live-now-temp">{cur ? t(cur.temperature) : '--'}</span>
            <span className="live-now-ic">{cur ? <CondIcon p={cur} size={52} color="var(--primary)" /> : null}</span>
          </div>
          <div className="live-now-cond">{cur?.shortForecast ?? (w.loading ? 'Loading…' : 'Unavailable')}</div>
          {c?.feelsLikeF != null && <div className="live-now-feels">Feels like {t(c.feelsLikeF)}</div>}
        </div>
        <div className="live-rail-foot">Auros by Meridian</div>
      </aside>

      {/* Main stage */}
      <section className="live-stage">
        <div className="live-topbar">
          <span className="live-panel-title">{title}</span>
          <div className="live-controls">
            <button onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Resume rotation' : 'Pause rotation'}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
            <button onClick={advance} aria-label="Next panel"><SkipForward size={15} /></button>
            <button onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute music' : 'Mute music'}>{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
            <button onClick={onExit} aria-label="Exit Auros Live"><X size={15} /></button>
          </div>
        </div>

        <div className="live-panel" key={panel}>
          {panel === 'alert' && breakInAlert ? (
            <div className="live-breakin" style={{ '--sev': sevColor } as CSSProperties}>
              <div className="live-breakin-badge"><TriangleAlert size={22} /> {breakInAlert.severity?.toUpperCase() || 'SEVERE'}</div>
              <div className="live-breakin-event">{breakInAlert.event}</div>
              {breakInAlert.areaDesc && <div className="live-breakin-area">{breakInAlert.areaDesc}</div>}
              {breakUntil && <div className="live-breakin-until">In effect until {breakUntil}</div>}
              {breakInAlert.instruction && <div className="live-breakin-instr">{breakInAlert.instruction}</div>}
            </div>
          ) : panel === 'now' ? (
            <div className="live-grid">
              {(() => { let n = 0; return [
                c?.feelsLikeF != null && <Stat key="feels" i={n++} icon={<Thermometer size={20} />} k="Feels Like" v={t(c.feelsLikeF)} />,
                cur?.probabilityOfPrecipitation?.value != null && <Stat key="rain" i={n++} icon={<Umbrella size={20} />} k="Rain Chance" v={`${cur.probabilityOfPrecipitation.value}%`} />,
                cur && <Stat key="wind" i={n++} icon={<Wind size={20} />} k="Wind" v={`${cur.windDirection} ${cur.windSpeed}`} />,
                c?.humidity != null && <Stat key="hum" i={n++} icon={<Droplets size={20} />} k="Humidity" v={`${c.humidity}%`} />,
                c?.dewpointF != null && <Stat key="dew" i={n++} icon={<Droplets size={20} />} k="Dew Point" v={t(c.dewpointF)} />,
                c?.pressureHpa != null && <Stat key="pres" i={n++} icon={<Gauge size={20} />} k="Pressure" v={u === 'C' ? `${Math.round(c.pressureHpa)} hPa` : `${(c.pressureHpa * 0.02953).toFixed(2)} in`} />,
                c?.visibilityM != null && <Stat key="vis" i={n++} icon={<Eye size={20} />} k="Visibility" v={u === 'C' ? `${Math.round(c.visibilityM / 1000)} km` : `${Math.round(c.visibilityM / 1609)} mi`} />,
                c?.uv != null && <Stat key="uv" i={n++} icon={<Zap size={20} />} k="UV Index" v={`${Math.round(c.uv)}`} sub={uvInfo(c.uv)} color={uvColor(c.uv)} />,
              ]; })()}
            </div>
          ) : panel === 'hourly' ? (
            <div className="live-hourly">
              {w.hourly.slice(0, 8).map((h, i) => (
                <div className="live-hour" key={h.startTime} style={{ animationDelay: `${i * 45}ms` }}>
                  <div className="live-hour-t">{fmtHour(h.startTime)}</div>
                  <div className="live-hour-ic"><CondIcon p={h} size={34} color="var(--primary)" /></div>
                  <div className="live-hour-temp">{t(h.temperature)}</div>
                  <div className="live-hour-pop">{h.probabilityOfPrecipitation?.value ?? 0}%</div>
                </div>
              ))}
              {w.hourly.length === 0 && <div className="live-empty">{w.loading ? 'Loading hourly forecast…' : 'Hourly forecast unavailable'}</div>}
            </div>
          ) : panel === 'radar' ? (
            <LiveRadar lat={selected.lat} lon={selected.lon} />
          ) : panel === 'extended' ? (
            <div className="live-ext">
              {days.map((d, i) => (
                <div className="live-day" key={d.p.startTime} style={{ animationDelay: `${i * 55}ms` }}>
                  <div className="live-day-name">{d.label}</div>
                  <div className="live-day-ic"><CondIcon p={d.p} size={40} color="var(--primary)" /></div>
                  <div className="live-day-cond">{d.p.shortForecast}</div>
                  {d.pop >= 10 && <div className="live-day-pop"><Umbrella size={13} /> {d.pop}%</div>}
                  <div className="live-day-hi">{t(d.hi)}</div>
                  <div className="live-day-lo">{d.lo != null ? t(d.lo) : '--'}</div>
                </div>
              ))}
              {days.length === 0 && <div className="live-empty">{w.loading ? 'Loading extended forecast…' : 'Extended forecast unavailable'}</div>}
            </div>
          ) : (
            <div className="live-grid">
              {(() => { let n = 0; return [
                c?.sunrise && <Stat key="sr" i={n++} icon={<Sunrise size={20} />} k="Sunrise" v={fmtClockTime(c.sunrise)} />,
                c?.sunset && <Stat key="ss" i={n++} icon={<Sunset size={20} />} k="Sunset" v={fmtClockTime(c.sunset)} />,
                c?.uv != null && <Stat key="uv2" i={n++} icon={<Zap size={20} />} k="UV Index" v={`${Math.round(c.uv)}`} sub={uvInfo(c.uv)} color={uvColor(c.uv)} />,
                c?.aqi != null && <Stat key="aqi" i={n++} icon={<Wind size={20} />} k="Air Quality" v={`${c.aqi}`} sub={aqiInfo(c.aqi).label} color={aqiInfo(c.aqi).color} />,
                pollen && <Stat key="pol" i={n++} icon={<Leaf size={20} />} k="Pollen" v={pollenInfo(pollen.index).label} sub={pollen.triggers.join(', ') || undefined} color={pollenInfo(pollen.index).color} />,
                c?.dewpointF != null && <Stat key="dew2" i={n++} icon={<Droplets size={20} />} k="Dew Point" v={t(c.dewpointF)} />,
              ]; })()}
            </div>
          )}
        </div>

        <div className="live-dots">
          {activePanels.map((p, i) => <span key={p.key} className={`live-dot${i === idx % activePanels.length ? ' on' : ''}`} />)}
        </div>
      </section>

      {/* Bottom crawl */}
      <div className={`live-crawl ${crawlClass}`}>
        <span className="live-crawl-tag" style={tagStyle}>{crawlTag}</span>
        <div className="live-crawl-mask">
          <div className="live-crawl-track" style={{ animationDuration: crawlDur }}>
            <span>{crawlText}</span>
            <span aria-hidden="true">{crawlText}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
