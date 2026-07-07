import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { X, Pause, Play, Volume2, VolumeX, SkipForward, Zap, MapPin, Droplets, Wind, Gauge, Eye, Sunrise, Sunset, Umbrella, Thermometer, Leaf } from 'lucide-react';
import { useLocations } from '../context/LocationsContext';
import { useWeather } from '../hooks/useWeather';
import { useConditions } from '../hooks/useConditions';
import { usePollen } from '../hooks/usePollen';
import { aqiInfo, uvInfo, uvColor } from '../api/conditions';
import { pollenInfo } from '../api/pollen';
import { usePrefs, convertTemp } from '../lib/prefs';
import { CondIcon } from '../components/CondIcon';
import type { NwsPeriod } from '../api/nws';
import './AurosLive.css';

// Auros Live — a continuous, Weatherscan-style local weather broadcast in the
// Auros look: a persistent "now" rail, a main stage that auto-rotates through
// panels, a bottom alert crawl, and optional looping background music.

type PanelKey = 'now' | 'hourly' | 'extended' | 'almanac';
const PANELS: { key: PanelKey; title: string }[] = [
  { key: 'now', title: 'Current Conditions' },
  { key: 'hourly', title: 'Hourly Forecast' },
  { key: 'extended', title: 'Extended Forecast' },
  { key: 'almanac', title: 'Sun & Air' },
];
const PANEL_MS = 12_000; // seconds each panel holds before advancing

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

function Stat({ icon, k, v, sub, color }: { icon: ReactNode; k: string; v: string; sub?: string; color?: string }) {
  return (
    <div className="live-stat">
      <span className="live-stat-ic">{icon}</span>
      <div className="live-stat-k">{k}</div>
      <div className="live-stat-v" style={color ? { color } : undefined}>{v}</div>
      {sub && <div className="live-stat-sub">{sub}</div>}
    </div>
  );
}

export function AurosLive({ onExit }: { onExit: () => void }) {
  const { selected } = useLocations();
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

  // Panel rotation
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % PANELS.length), PANEL_MS);
    return () => clearInterval(id);
  }, [paused]);
  const advance = () => setIdx((i) => (i + 1) % PANELS.length);
  const { key: panel, title } = PANELS[idx];

  // Alerts → crawl
  const warnings = w.alerts.filter((a) => /warning/i.test(a.event));
  const hasWarning = warnings.length > 0;
  const crawlClass = hasWarning ? 'warn' : w.alerts.length ? 'watch' : '';
  const crawlText = w.alerts.length
    ? w.alerts.map((a) => (a.headline ? a.headline : a.event)).join('      •      ')
    : `All clear across ${shortPlace(selected.name)} — no active watches, warnings, or advisories`;

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
    a.volume = hasWarning ? 0.12 : 0.5; // duck under an active warning — safety over ambiance
    if (!muted && a.paused && tracks.length) a.play().catch(() => {});
  }, [muted, hasWarning, tracks]);

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

  // Extended: pair each daytime period with the following night for the low.
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

  return (
    <div className="live" role="region" aria-label="Auros Live">
      <div className="live-controls">
        <button onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Resume rotation' : 'Pause rotation'}>{paused ? <Play size={18} /> : <Pause size={18} />}</button>
        <button onClick={advance} aria-label="Next panel"><SkipForward size={18} /></button>
        <button onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute music' : 'Mute music'}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
        <button onClick={onExit} aria-label="Exit Auros Live"><X size={18} /></button>
      </div>

      {/* Left "now" rail */}
      <aside className="live-rail">
        <div className="live-brand"><Zap size={18} /> Auros <span className="live-badge">LIVE</span></div>
        <div className="live-clock">
          <div className="live-date">{dateStr}</div>
          <div className="live-time">{timeStr}</div>
        </div>
        <div className="live-loc"><MapPin size={15} /> {place}</div>
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
          <span className="live-topbar-loc">{place}</span>
        </div>
        <div className="live-panel" key={panel}>
          {panel === 'now' && (
            <div className="live-grid">
              {c?.feelsLikeF != null && <Stat icon={<Thermometer size={20} />} k="Feels Like" v={t(c.feelsLikeF)} />}
              {cur?.probabilityOfPrecipitation?.value != null && <Stat icon={<Umbrella size={20} />} k="Rain Chance" v={`${cur.probabilityOfPrecipitation.value}%`} />}
              {cur && <Stat icon={<Wind size={20} />} k="Wind" v={`${cur.windDirection} ${cur.windSpeed}`} />}
              {c?.humidity != null && <Stat icon={<Droplets size={20} />} k="Humidity" v={`${c.humidity}%`} />}
              {c?.dewpointF != null && <Stat icon={<Droplets size={20} />} k="Dew Point" v={t(c.dewpointF)} />}
              {c?.pressureHpa != null && <Stat icon={<Gauge size={20} />} k="Pressure" v={u === 'C' ? `${Math.round(c.pressureHpa)} hPa` : `${(c.pressureHpa * 0.02953).toFixed(2)} in`} />}
              {c?.visibilityM != null && <Stat icon={<Eye size={20} />} k="Visibility" v={u === 'C' ? `${Math.round(c.visibilityM / 1000)} km` : `${Math.round(c.visibilityM / 1609)} mi`} />}
              {c?.uv != null && <Stat icon={<Zap size={20} />} k="UV Index" v={`${Math.round(c.uv)}`} sub={uvInfo(c.uv)} color={uvColor(c.uv)} />}
            </div>
          )}

          {panel === 'hourly' && (
            <div className="live-hourly">
              {w.hourly.slice(0, 8).map((h) => (
                <div className="live-hour" key={h.startTime}>
                  <div className="live-hour-t">{fmtHour(h.startTime)}</div>
                  <div className="live-hour-ic"><CondIcon p={h} size={34} color="var(--primary)" /></div>
                  <div className="live-hour-temp">{t(h.temperature)}</div>
                  <div className="live-hour-pop">{(h.probabilityOfPrecipitation?.value ?? 0)}%</div>
                </div>
              ))}
              {w.hourly.length === 0 && <div className="live-empty">{w.loading ? 'Loading hourly forecast…' : 'Hourly forecast unavailable'}</div>}
            </div>
          )}

          {panel === 'extended' && (
            <div className="live-ext">
              {days.map((d) => (
                <div className="live-day" key={d.p.startTime}>
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
          )}

          {panel === 'almanac' && (
            <div className="live-grid">
              {c?.sunrise && <Stat icon={<Sunrise size={20} />} k="Sunrise" v={fmtClockTime(c.sunrise)} />}
              {c?.sunset && <Stat icon={<Sunset size={20} />} k="Sunset" v={fmtClockTime(c.sunset)} />}
              {c?.uv != null && <Stat icon={<Zap size={20} />} k="UV Index" v={`${Math.round(c.uv)}`} sub={uvInfo(c.uv)} color={uvColor(c.uv)} />}
              {c?.aqi != null && <Stat icon={<Wind size={20} />} k="Air Quality" v={`${c.aqi}`} sub={aqiInfo(c.aqi).label} color={aqiInfo(c.aqi).color} />}
              {pollen && <Stat icon={<Leaf size={20} />} k="Pollen" v={pollenInfo(pollen.index).label} sub={pollen.triggers.join(', ') || undefined} color={pollenInfo(pollen.index).color} />}
              {c?.dewpointF != null && <Stat icon={<Droplets size={20} />} k="Dew Point" v={t(c.dewpointF)} />}
            </div>
          )}
        </div>

        {/* Panel progress dots */}
        <div className="live-dots">
          {PANELS.map((p, i) => <span key={p.key} className={`live-dot${i === idx ? ' on' : ''}`} />)}
        </div>
      </section>

      {/* Bottom alert crawl */}
      <div className={`live-crawl ${crawlClass}`}>
        <span className="live-crawl-tag">{hasWarning ? 'WARNING' : w.alerts.length ? 'ALERTS' : 'NOW'}</span>
        <div className="live-crawl-mask">
          <div className="live-crawl-track">
            <span>{crawlText}</span>
            <span aria-hidden="true">{crawlText}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
