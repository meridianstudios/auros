import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Pause, Play, Volume2, VolumeX, SkipForward, Zap, MapPin, ChevronDown, Droplets, Wind, Gauge, Eye, Sunrise, Sunset, Umbrella, Thermometer, Leaf, TriangleAlert, Music, Megaphone, ALargeSmall, Siren, RotateCw } from 'lucide-react';
import { useLocations } from '../context/LocationsContext';
import { useWeather } from '../hooks/useWeather';
import { useConditions } from '../hooks/useConditions';
import { usePollen } from '../hooks/usePollen';
import { aqiInfo, uvInfo, uvColor } from '../api/conditions';
import { pollenInfo } from '../api/pollen';
import { useLandmarkImages } from '../api/landmark';
import { usePrefs, convertTemp } from '../lib/prefs';
import { getPlayableUrl, musicUrl } from '../lib/musicCache';
import { speak, stopSpeaking } from '../lib/voice';
import { CondIcon } from '../components/CondIcon';
import { AeroWx } from '../components/AeroWx';
import { RetroWx } from '../components/RetroWx';
import { WeatherscanWx } from '../components/WeatherscanWx';
import { CITIES, MAJOR_CITIES } from '../data/cities';
import { severityColor } from '../theme/colors';
import { playAlertBeeps } from '../lib/eas';
import type { NwsPeriod, NwsAlert } from '../api/nws';
import './AurosLive.css';

// Auros Live — a continuous, Weatherscan-style local weather broadcast in the
// Auros look: a persistent "now" rail, a main stage that auto-rotates through
// panels (incl. a live radar), a scrolling NOW/alert crawl, optional looping
// music, and a full-screen severe-weather break-in when a warning is active.

type PanelKey = 'now' | 'hourly' | 'radar' | 'map' | 'local' | 'extended' | 'almanac';
const PANELS: { key: PanelKey; title: string }[] = [
  { key: 'now', title: 'Current Conditions' },
  { key: 'hourly', title: 'Hourly Forecast' },
  { key: 'radar', title: 'Local Radar' },
  { key: 'map', title: 'Regional Map' },
  { key: 'local', title: 'Local Map' },
  { key: 'extended', title: 'Extended Forecast' },
  { key: 'almanac', title: 'Sun & Air' },
];
const PANEL_MS = 12_000;

// On phones, Auros Live locks to landscape and renders the full desktop layout at
// this fixed "design" size, scaled down to fit the screen (tablet/desktop unchanged).
const PHONE_DESIGN = { w: 1440, h: 760 };

// Short spoken intro per panel (broadcast styles only) — just the segment name,
// the way the real Local on the 8s announced each screen. Kept terse on purpose.
const PANEL_NARRATION: Record<PanelKey, string> = {
  now: 'Your local forecast.',
  hourly: 'Your hourly forecast.',
  radar: 'Your local radar.',
  map: 'Your regional forecast.',
  local: 'Conditions in your area.',
  extended: 'Your extended forecast.',
  almanac: 'Your sun and air report.',
};

// Weatherscan top-bar breadcrumb labels (short) per panel — the "‹ RADAR ‹ AIRPORTS" nav.
const WS_NAV: Record<PanelKey, string> = {
  now: 'Current', hourly: 'Hourly', radar: 'Radar', map: 'Regional', local: 'Local', extended: 'Extended', almanac: 'Almanac',
};

const IEM = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';
const WWA_EXPORT = 'https://mapservices.weather.noaa.gov/eventdriven/rest/services/WWA/watch_warn_adv/MapServer/export';
const WWA_LAYERDEFS = encodeURIComponent("{\"1\":\"prod_type LIKE '%Warning%'\"}");
const WORLD_M = 20037508.342789244;
const TRANSPARENT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/QBYAAAAAElFTkSuQmCC';

// Animated reflectivity frames — IEM national mosaic, 5-min-lagged past frames
// (40 min ago → now). Each becomes its own preloaded tile layer so the loop
// swaps by opacity only (no per-tick tile fetch = no black flashing).
const RADAR_FRAMES = [40, 35, 30, 25, 20, 15, 10, 5, 0].map((m) => (m === 0 ? '' : `-m${String(m).padStart(2, '0')}m`));
const radarFrameUrl = (i: number) => `${IEM}/nexrad-n0q-900913${RADAR_FRAMES[i]}/{z}/{x}/{y}.png`;

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
// Display name for the "now playing" bar — strip the folder + file extension.
const trackTitle = (f: string) => f.replace(/\.[^/.]+$/, '').replace(/^.*\//, '').trim();

// Weatherscan mode plays the real TWC/Weatherscan alert tone (a short 3-frequency
// beep clip) instead of the synthesized EAS tone. Lazily created, reused.
let wscanAlertAudio: HTMLAudioElement | null = null;
function playWeatherscanAlert() {
  try {
    if (!wscanAlertAudio) wscanAlertAudio = new Audio('/live-audio/wscan-alert.m4a');
    wscanAlertAudio.currentTime = 0;
    wscanAlertAudio.volume = 1;
    void wscanAlertAudio.play().catch(() => {});
  } catch { /* best effort */ }
}
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

    // Animated radar loop. Create every frame VISIBLE so Leaflet loads all their
    // tiles up front, then hide all but the newest in the same tick — before the
    // browser paints, so there's no flash. Tiles stay cached, so the loop only
    // toggles opacity and never re-fetches mid-loop (no black flashing).
    const frames = RADAR_FRAMES.map((_, i) =>
      L.tileLayer(radarFrameUrl(i), { opacity: 0.72, zIndex: 5, maxNativeZoom: 14, updateWhenIdle: false, keepBuffer: 4, errorTileUrl: TRANSPARENT }).addTo(map)
    );
    let fi = frames.length - 1;
    frames.forEach((l, i) => l.setOpacity(i === fi ? 0.72 : 0)); // show newest, hide the rest
    let hold = 0;
    const anim = setInterval(() => {
      // Pause a few beats on the newest frame before looping back to the start.
      if (fi === frames.length - 1 && hold < 3) { hold++; return; }
      hold = 0;
      frames[fi].setOpacity(0);
      fi = (fi + 1) % frames.length;
      frames[fi].setOpacity(0.72);
    }, 500);

    const wwa = L.tileLayer('', { opacity: 0.5, zIndex: 6, updateWhenIdle: false, keepBuffer: 2, errorTileUrl: TRANSPARENT });
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
    return () => { clearInterval(anim); clearTimeout(t); map.remove(); };
  }, [lat, lon]);
  return <div className="live-radar" ref={ref} />;
}

// Non-interactive regional FORECAST map: a gray geographic base with the nearest
// cities' current temp + a real weather icon at each, the classic regional-map
// look. (Radar lives in its own panel.) The icon set is passed in so each style
// draws its own icons; we render the component to an SVG string for the map pin.
function LiveRegionalMap({ lat, lon, Icon, count = 8, zoom = 6, fit = false, majorOnly = false }: { lat: number; lon: number; Icon: typeof CondIcon; count?: number; zoom?: number; fit?: boolean; majorOnly?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { prefs } = usePrefs();
  const u = prefs.units;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Regional = broad view of major metros; local = the nearest towns (all cities).
    const near = (majorOnly ? MAJOR_CITIES : CITIES)
      .map((c) => ({ c, d: (c.lat - lat) ** 2 + ((c.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, count)
      .map((x) => x.c);
    const map = L.map(el, {
      zoomControl: false, attributionControl: false, dragging: false,
      scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false,
    }).setView([lat, lon], zoom);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 16 }).addTo(map);
    // Local map: frame the selected spot + its nearest towns (zoomed to your area).
    if (fit) map.fitBounds([[lat, lon] as [number, number], ...near.map((c) => [c.lat, c.lon] as [number, number])], { padding: [36, 36], maxZoom: 9 });
    // "You are here" marker so the map clearly centers on the selected location.
    L.circleMarker([lat, lon], { radius: 5, color: '#fff', weight: 2, fillColor: '#6E8BFF', fillOpacity: 1, interactive: false }).addTo(map);
    let alive = true;
    const qs = `latitude=${near.map((c) => c.lat).join(',')}&longitude=${near.map((c) => c.lon).join(',')}`;
    fetch(`https://api.open-meteo.com/v1/forecast?${qs}&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit`)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        const arr = Array.isArray(data) ? data : [data];
        near.forEach((c, i) => {
          const cur = arr[i]?.current;
          const tF = cur?.temperature_2m;
          if (typeof tF !== 'number') return;
          const period = { shortForecast: wmoLabel(cur?.weather_code), isDaytime: cur?.is_day !== 0 } as unknown as NwsPeriod;
          const iconHtml = renderToStaticMarkup(<Icon p={period} size={34} color="#e8eefb" />);
          const html = `<div class="live-map-city"><div class="live-map-name">${c.name}</div><div class="live-map-info"><span class="live-map-temp">${convertTemp(tF, u)}°</span>${iconHtml}</div></div>`;
          L.marker([c.lat, c.lon], { icon: L.divIcon({ className: 'live-map-pin', html, iconSize: [0, 0] }), interactive: false }).addTo(map);
        });
      })
      .catch(() => {});
    const t = setTimeout(() => map.invalidateSize(), 140);
    return () => { alive = false; clearTimeout(t); map.remove(); };
  }, [lat, lon, u, Icon, count, zoom, fit, majorOnly]);
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
  const [bgIdx, setBgIdx] = useState(0);
  const w = useWeather(selected.lat, selected.lon);
  const c = useConditions(selected.lat, selected.lon);
  const pollen = usePollen(selected.lat, selected.lon);
  const { prefs, setLiveVoice, setLiveBigText } = usePrefs();
  const u = prefs.units;
  // Each style has its own icon set: Aero/Weatherscan = glossy, retro = flat 90s,
  // Modern = line.
  const aero = prefs.liveStyle === 'aero';
  const retro = prefs.liveStyle === 'retro';
  const wscan = prefs.liveStyle === 'wscan';
  const modern = !aero && !retro && !wscan;
  const WxIcon = wscan ? WeatherscanWx : aero ? AeroWx : retro ? RetroWx : CondIcon;
  const t = (f?: number | null) => (f == null ? '--' : `${convertTemp(f, u)}°`);
  // Current-style ref so the alert-sound choice (real Weatherscan tone vs. the
  // synthesized EAS tone) is always up to date inside the fire-once effects.
  const wscanRef = useRef(wscan);
  wscanRef.current = wscan;
  const fireAlertSound = () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (wscanRef.current) playWeatherscanAlert(); else playAlertBeeps();
  };

  // Phone handling: lock to landscape (portrait → rotate prompt) and scale the
  // full desktop layout down to fit. `min(w,h) >= 560` = tablet/desktop → untouched.
  const [vpMode, setVpMode] = useState<'normal' | 'portrait' | 'landscape'>('normal');
  const [vpScale, setVpScale] = useState(1);
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
      if (Math.min(w, h) >= 560) { setVpMode('normal'); setVpScale(1); return; }
      // Portrait rotate-prompt only on real touch devices (a tiny desktop window
      // just uses the normal stacked layout, not a "rotate your phone" screen).
      if (h >= w) { setVpMode(coarse ? 'portrait' : 'normal'); return; }
      setVpMode('landscape');
      setVpScale(Math.min(w / PHONE_DESIGN.w, h / PHONE_DESIGN.h));
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('orientationchange', compute);
    return () => { window.removeEventListener('resize', compute); window.removeEventListener('orientationchange', compute); };
  }, []);

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

  // Alert popup: a NEW warning pops a full-screen alert box over the stage. It
  // auto-dismisses after ~15s if the setting is on (then it lives on in the
  // crawl), or the user can tap it to dismiss; it clears on its own when the
  // warning expires. The stage keeps cycling once the box is gone.
  const [boxAlert, setBoxAlert] = useState<NwsAlert | null>(null);
  const breakId = breakInAlert?.id ?? null;
  useEffect(() => {
    if (!breakId) { setBoxAlert(null); return; }
    setBoxAlert(breakInAlert);
    fireAlertSound();
    if (prefs.liveAlertAutoHide) {
      const id = setTimeout(() => setBoxAlert(null), 15_000);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakId]);

  // Panel rotation (paused while the alert box is up).
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || boxAlert) return;
    const id = setInterval(() => setIdx((i) => i + 1), PANEL_MS);
    return () => clearInterval(id);
  }, [paused, boxAlert]);
  const advance = () => setIdx((i) => i + 1);
  const active = PANELS[idx % PANELS.length];
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

  // Background music. Weatherscan-style: a pool played in random order with a
  // no-repeat cooldown (a track won't return until several others have played),
  // and we only ever hold ~2 files in memory — the one playing plus the next,
  // which we preload in the final seconds so there's no gap and no app bloat.
  const curElRef = useRef<HTMLAudioElement | null>(null);
  const targetVol = useRef(0.5);
  const mutedRef = useRef(false);
  const [tracks, setTracks] = useState<string[]>([]);
  const [muted, setMuted] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<string | null>(null);
  const [voiceActive, setVoiceActive] = useState(false); // narration is speaking → duck the music
  useEffect(() => {
    let live = true;
    fetch('/live-music/tracks.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => { if (live && Array.isArray(list)) setTracks(list.filter((x) => typeof x === 'string')); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!tracks.length) return;
    const N = tracks.length;
    // Don't replay a track until this many others have gone by (capped by pool size).
    const cooldown = Math.min(N - 1, 8);
    const recent: number[] = [];
    const pick = () => {
      let pool: number[] = [];
      for (let i = 0; i < N; i++) if (!recent.includes(i)) pool.push(i);
      if (!pool.length) pool = tracks.map((_, i) => i); // pool smaller than cooldown → allow all
      const idx = pool[Math.floor(Math.random() * pool.length)];
      recent.push(idx);
      while (recent.length > cooldown) recent.shift();
      return idx;
    };

    const els = [new Audio(), new Audio()]; // double buffer: one plays, one preloads
    const objUrls = new Map<HTMLAudioElement, string>(); // blob: URLs to revoke when swapped out
    let cur = 0;          // which element is currently playing
    let nextTrack = -1;   // track index preloaded into the idle element
    let nextReady = false;// idle element has finished loading the preloaded track
    let armed = false;    // have we begun preloading the next track yet?
    let fails = 0;        // consecutive load failures → give up if every track is bad
    let disposed = false; // set on cleanup so in-flight fetches don't touch dead elements
    const resumers: (() => void)[] = [];
    const apply = (e: HTMLAudioElement) => { e.muted = mutedRef.current; e.volume = targetVol.current; };
    const setSrc = (e: HTMLAudioElement, url: string) => {
      const old = objUrls.get(e);
      if (old) { URL.revokeObjectURL(old); objUrls.delete(e); }
      e.src = url;
      if (url.startsWith('blob:')) objUrls.set(e, url);
    };
    const free = (e: HTMLAudioElement) => {
      const old = objUrls.get(e);
      if (old) { URL.revokeObjectURL(old); objUrls.delete(e); }
      e.removeAttribute('src'); e.load();
    };
    const tryPlay = (e: HTMLAudioElement) => {
      const p = e.play();
      if (p && p.catch) p.catch(() => {
        // Autoplay blocked before a gesture → start on the first tap/click.
        const resume = () => { e.play().catch(() => {}); };
        resumers.push(resume);
        window.addEventListener('pointerdown', resume, { once: true });
      });
    };
    // Load + play a track on the current element (first track, or fallback when the
    // next one wasn't preloaded in time). The URL comes from the on-device cache or
    // a one-time fetch, so this is async.
    const play = async (trackIdx: number) => {
      const url = await getPlayableUrl(musicUrl(tracks[trackIdx]));
      if (disposed) { if (url.startsWith('blob:')) URL.revokeObjectURL(url); return; }
      const e = els[cur];
      setSrc(e, url);
      apply(e);
      curElRef.current = e;
      setNowPlaying(tracks[trackIdx]);
      tryPlay(e);
      armed = false; nextTrack = -1; nextReady = false;
    };
    // Preload the next track into the idle element during the current track's tail.
    const arm = async () => {
      if (armed) return;
      armed = true;
      const ti = pick();
      nextTrack = ti;
      const url = await getPlayableUrl(musicUrl(tracks[ti]));
      if (disposed || nextTrack !== ti) { if (url.startsWith('blob:')) URL.revokeObjectURL(url); return; }
      setSrc(els[cur ^ 1], url);
      nextReady = true;
    };
    // Advance to the next track — reuse the element we preloaded, or pick one now.
    const next = () => {
      const done = els[cur];
      done.pause();
      if (nextTrack >= 0 && nextReady) {
        const ti = nextTrack;
        cur ^= 1;
        const e = els[cur];
        apply(e);
        curElRef.current = e;
        setNowPlaying(tracks[ti]);
        tryPlay(e);
        armed = false; nextTrack = -1; nextReady = false;
        free(done); // release the finished track
      } else {
        free(done);
        armed = false; nextTrack = -1; nextReady = false;
        play(pick()); // wasn't preloaded in time → load one now
      }
    };
    const onTime = (ev: Event) => {
      if (ev.target !== els[cur]) return;
      const e = els[cur];
      if (isFinite(e.duration) && e.duration - e.currentTime <= 12) arm();
    };
    const onEnded = (ev: Event) => { if (ev.target === els[cur]) next(); };
    const onError = (ev: Event) => {
      if (ev.target !== els[cur]) return;
      if (!els[cur].getAttribute('src')) return; // ignore the transient empty-src reset
      if (++fails > N) return; // every track failing to load → stop quietly
      next();
    };
    const onPlaying = (ev: Event) => { if (ev.target === els[cur]) fails = 0; };
    els.forEach((e) => {
      e.addEventListener('timeupdate', onTime);
      e.addEventListener('ended', onEnded);
      e.addEventListener('error', onError);
      e.addEventListener('playing', onPlaying);
    });
    play(pick());
    return () => {
      disposed = true;
      resumers.forEach((r) => window.removeEventListener('pointerdown', r));
      els.forEach((e) => {
        e.removeEventListener('timeupdate', onTime);
        e.removeEventListener('ended', onEnded);
        e.removeEventListener('error', onError);
        e.removeEventListener('playing', onPlaying);
        e.pause(); free(e);
      });
      objUrls.clear();
      curElRef.current = null;
    };
  }, [tracks]);
  useEffect(() => {
    mutedRef.current = muted;
    // Duck hard for a warning (safety over ambiance), gently under the narration
    // voice so the words stay clear, else normal ambiance level.
    targetVol.current = boxAlert ? 0.08 : voiceActive ? 0.14 : 0.5;
    const e = curElRef.current;
    if (!e) return;
    e.muted = muted;
    e.volume = targetVol.current;
    if (!muted && e.paused && tracks.length) e.play().catch(() => {});
  }, [muted, boxAlert, tracks, voiceActive]);

  // Esc exits
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  // Settings "Test the alert alarm" also previews the Live alert box + beeps.
  useEffect(() => {
    const onTest = () => {
      const test: NwsAlert = {
        id: `auros-live-test-${Math.floor(Math.random() * 1e9)}`,
        event: 'Severe Thunderstorm Warning',
        severity: 'Severe',
        headline: 'This is a test of the Auros Live alert.',
        areaDesc: 'Test County — no actual alert is in effect.',
        instruction: 'This is only a test. No action is needed.',
        ends: new Date(Date.now() + 1_800_000).toISOString(),
      };
      setBoxAlert(test);
      fireAlertSound();
      if (prefs.liveAlertAutoHide) setTimeout(() => setBoxAlert((b) => (b?.id === test.id ? null : b)), 15_000);
    };
    window.addEventListener('auros:test-alarm', onTest);
    return () => window.removeEventListener('auros:test-alarm', onTest);
  }, [prefs.liveAlertAutoHide]);

  const place = shortPlace(selected.name === 'My Location' && w.point?.city ? `${w.point.city}, ${w.point.state}` : selected.name);

  // Photo backdrop: town/city images from the free Wikipedia media API, cycled
  // slowly. Empty for places without photos → the plain dark background shows.
  const bgImages = useLandmarkImages(place);
  useEffect(() => { setBgIdx(0); }, [place]);
  useEffect(() => {
    if (bgImages.length < 2) return;
    const id = setInterval(() => setBgIdx((i) => i + 1), 26_000);
    return () => clearInterval(id);
  }, [bgImages.length]);

  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const shortDate = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
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

  // Weatherscan header breadcrumb: the next few panels in rotation, shown as a
  // ‹-chevron nav on the right of the top bar (like the real "‹ RADAR ‹ AIRPORTS").
  const wsNav = [1, 2, 3].map((o) => WS_NAV[PANELS[(idx + o) % PANELS.length].key]);

  const sevColor = boxAlert ? severityColor(boxAlert.severity, boxAlert.event) : 'var(--live-red)';
  const breakUntil = boxAlert?.ends
    ? new Date(boxAlert.ends).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
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

  // Current-conditions stat list (shared: default grid + Weatherscan list layout).
  const nowStats = (() => { let n = 0; return [
    c?.feelsLikeF != null && <Stat key="feels" i={n++} icon={<Thermometer size={20} />} k="Feels Like" v={t(c.feelsLikeF)} />,
    cur?.probabilityOfPrecipitation?.value != null && <Stat key="rain" i={n++} icon={<Umbrella size={20} />} k="Rain Chance" v={`${cur.probabilityOfPrecipitation.value}%`} />,
    cur && <Stat key="wind" i={n++} icon={<Wind size={20} />} k="Wind" v={`${cur.windDirection} ${cur.windSpeed}`} />,
    c?.humidity != null && <Stat key="hum" i={n++} icon={<Droplets size={20} />} k="Humidity" v={`${c.humidity}%`} />,
    c?.dewpointF != null && <Stat key="dew" i={n++} icon={<Droplets size={20} />} k="Dew Point" v={t(c.dewpointF)} />,
    c?.pressureHpa != null && <Stat key="pres" i={n++} icon={<Gauge size={20} />} k="Pressure" v={u === 'C' ? `${Math.round(c.pressureHpa)} hPa` : `${(c.pressureHpa * 0.02953).toFixed(2)} in`} />,
    c?.visibilityM != null && <Stat key="vis" i={n++} icon={<Eye size={20} />} k="Visibility" v={u === 'C' ? `${Math.round(c.visibilityM / 1000)} km` : `${Math.round(c.visibilityM / 1609)} mi`} />,
    c?.uv != null && <Stat key="uv" i={n++} icon={<Zap size={20} />} k="UV Index" v={`${Math.round(c.uv)}`} sub={uvInfo(c.uv)} color={uvColor(c.uv)} />,
  ]; })();

  // ---- Broadcast narration ----------------------------------------------
  // Only the era looks narrate: Weatherscan (real voice was female) and Frutiger
  // Aero (TWC IntelliStar era, male voiceover). Modern + 90s stay silent. Speaks
  // ONLY the short segment intro as each panel opens, ducking the music — like the
  // real Local on the 8s ("Your local forecast", "Your local radar"), not a readout.
  const voiceGender: 'female' | 'male' | null = wscan ? 'female' : aero ? 'male' : null;
  useEffect(() => {
    if (!prefs.liveVoice || !voiceGender || boxAlert) { stopSpeaking(); setVoiceActive(false); return; }
    const text = PANEL_NARRATION[PANELS[idx % PANELS.length].key];
    if (!text) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setVoiceActive(true);
      // Natural pitch (the real broadcasts were human voices), with a slight
      // gender-appropriate lift so the short line has some life, not a flat monotone.
      speak(text, { gender: voiceGender, rate: 1, pitch: voiceGender === 'female' ? 1.06 : 0.97 })
        .finally(() => { if (!cancelled) setVoiceActive(false); });
    }, 550); // let the panel start animating in, then the intro
    return () => { cancelled = true; clearTimeout(timer); stopSpeaking(); setVoiceActive(false); };
  }, [idx, prefs.liveVoice, boxAlert, voiceGender]);
  // Stop any narration when leaving Auros Live.
  useEffect(() => () => stopSpeaking(), []);

  const controls = (
    <div className="live-controls">
      <button onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Resume rotation' : 'Pause rotation'}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
      <button onClick={advance} aria-label="Next panel"><SkipForward size={15} /></button>
      <button onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute music' : 'Mute music'}>{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
      {(aero || wscan) && <button onClick={() => setLiveVoice(!prefs.liveVoice)} className={prefs.liveVoice ? '' : 'off'} aria-label={prefs.liveVoice ? 'Turn narration off' : 'Turn narration on'} title={prefs.liveVoice ? 'Forecast narration on' : 'Forecast narration off'}><Megaphone size={15} /></button>}
      {wscan && <button onClick={() => setLiveBigText(!prefs.liveBigText)} className={prefs.liveBigText ? '' : 'off'} aria-label={prefs.liveBigText ? 'Use smaller text' : 'Use bigger text'} title={prefs.liveBigText ? 'Big text on' : 'Big text off'}><ALargeSmall size={15} /></button>}
      <button onClick={() => window.dispatchEvent(new CustomEvent('auros:test-alarm'))} aria-label="Test a severe-weather alert" title="Test alert"><Siren size={15} /></button>
      <button onClick={onExit} aria-label="Exit Auros Live"><X size={15} /></button>
    </div>
  );

  if (vpMode === 'portrait') {
    return (
      <div className="live-rotate">
        <div className="live-rotate-inner">
          <RotateCw size={44} />
          <div className="live-rotate-title">Rotate your phone</div>
          <div className="live-rotate-sub">Auros Live is a full-screen broadcast. Turn your phone sideways to watch.</div>
          <button onClick={onExit}>Exit</button>
        </div>
      </div>
    );
  }
  const scaleStyle: CSSProperties | undefined = vpMode === 'landscape'
    ? { width: PHONE_DESIGN.w, height: PHONE_DESIGN.h, inset: 'auto', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${vpScale})`, transformOrigin: 'center' }
    : undefined;

  return (
    <>
      {vpMode === 'landscape' && <div className="live-letterbox" aria-hidden="true" />}
      <div className={`live${boxAlert || breakIn ? ' live--alert' : ''}${prefs.liveBigText ? ' big-text' : ''}`} data-style={prefs.liveStyle} role="region" aria-label="Auros Live" style={scaleStyle}>
      {bgImages.length > 0 && (
        <>
          {bgImages.map((src, i) => (
            <div key={src} className={`live-bg${i === bgIdx % bgImages.length ? ' on' : ''}`} style={{ backgroundImage: `url("${src}")` }} aria-hidden="true" />
          ))}
          <div className="live-scrim" aria-hidden="true" />
        </>
      )}

      {/* Left "now" rail */}
      <aside className="live-rail">
        <div className="live-brand"><Zap size={18} /> Auros <span className="live-badge">LIVE</span></div>
        {(aero || retro) && <div className="live-sep" aria-hidden="true" />}
        <div className="live-clock">
          <div className="live-date">{wscan ? shortDate : dateStr}</div>
          <div className="live-time">{wscan ? timeStr.toLowerCase() : timeStr}</div>
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
        {aero && (
          <nav className="live-nav" aria-label="Panels">
            {PANELS.map((p, i) => (
              <button
                key={p.key}
                className={`live-nav-item${i === idx % PANELS.length ? ' on' : ''}`}
                onClick={() => setIdx(i)}
              >
                {p.title}
              </button>
            ))}
          </nav>
        )}
        <div className="live-now">
          {wscan && <div className="live-now-city">{place}</div>}
          <div className="live-now-label">NOW</div>
          <div className="live-now-main">
            <span className="live-now-temp">{cur ? t(cur.temperature) : '--'}</span>
            <span className="live-now-ic">{cur ? <WxIcon p={cur} size={52} color="var(--primary)" /> : null}</span>
          </div>
          <div className="live-now-cond">{cur?.shortForecast ?? (w.loading ? 'Loading…' : 'Unavailable')}</div>
          {c?.feelsLikeF != null && <div className="live-now-feels">Feels like {t(c.feelsLikeF)}</div>}
        </div>
        {wscan && (
          <div className="live-past3">
            <div className="live-past3-head">Past 3 Hours</div>
            <div className="live-past3-map"><LiveRadar lat={selected.lat} lon={selected.lon} /></div>
          </div>
        )}
        {nowPlaying && (
          <div className={`live-np${muted ? ' muted' : ''}`} title={trackTitle(nowPlaying)}>
            {muted ? <VolumeX size={14} /> : <Music size={14} />}
            <div className="live-np-body">
              <div className="live-np-label">{muted ? 'MUSIC MUTED' : 'NOW PLAYING'}</div>
              <div className="live-np-title">{trackTitle(nowPlaying)}</div>
            </div>
            {!muted && <span className="live-np-eq" aria-hidden="true"><i /><i /><i /></span>}
          </div>
        )}
        <div className="live-rail-foot">
          <span className="live-foot-mark"><Zap size={15} /> Auros</span>
          <span className="live-foot-sub">by Meridian</span>
        </div>
      </aside>

      {/* Main stage */}
      <section className="live-stage">
        <div className="live-mainbox">
        {wscan ? (
          <div className="live-wshead">
            <div className="live-wshead-bar">
              <span className="live-wshead-loc">{place}</span>
              <span className="live-wshead-nav">
                {wsNav.map((n, i) => <span className="live-wsnav-item" key={`${n}-${i}`}>{n}</span>)}
              </span>
              {controls}
            </div>
            <div className="live-wshead-sub">
              <span className="live-wshead-title">{boxAlert ? 'Severe Weather Alert' : title}</span>
              <span className="live-wshead-area">{place}</span>
            </div>
          </div>
        ) : (
          <div className="live-topbar">
            <span className="live-panel-title">{boxAlert ? 'Severe Weather Alert' : title}</span>
            {controls}
          </div>
        )}

        <div className="live-panel" key={boxAlert ? 'alert' : panel}>
          {boxAlert ? (
            <div className="live-breakin" style={{ '--sev': sevColor } as CSSProperties} onClick={() => setBoxAlert(null)} role="button" aria-label="Dismiss alert">
              <div className="live-breakin-badge"><TriangleAlert size={22} /> {boxAlert.severity?.toUpperCase() || 'SEVERE'}</div>
              <div className="live-breakin-event">{boxAlert.event}</div>
              {boxAlert.areaDesc && <div className="live-breakin-area">{boxAlert.areaDesc}</div>}
              {breakUntil && <div className="live-breakin-until">In effect until {breakUntil}</div>}
              {boxAlert.instruction && <div className="live-breakin-instr">{boxAlert.instruction}</div>}
              <div className="live-breakin-hint">Tap to dismiss{prefs.liveAlertAutoHide ? ' · auto-hides in 15s' : ''} · stays in the crawl below</div>
            </div>
          ) : panel === 'now' ? (
            wscan ? (
              <div className="live-wscurr">
                <div className="live-grid">{nowStats}</div>
                {cur && (
                  <div className="live-wscurr-side">
                    <div className="live-wscurr-ic"><WxIcon p={cur} size={78} color="#fff" /></div>
                    <div className="live-wscurr-cond">{cur.shortForecast}</div>
                    <div className="live-wscurr-big">{t(cur.temperature)}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="live-grid">{nowStats}</div>
            )
          ) : panel === 'hourly' ? (
            <div className="live-hourly">
              {w.hourly.slice(0, 8).map((h, i) => (
                <div className="live-hour" key={h.startTime} style={{ animationDelay: `${i * 45}ms` }}>
                  <div className="live-hour-t">{fmtHour(h.startTime)}</div>
                  <div className="live-hour-ic"><WxIcon p={h} size={34} color="var(--primary)" /></div>
                  <div className="live-hour-temp">{t(h.temperature)}</div>
                  <div className="live-hour-pop">{h.probabilityOfPrecipitation?.value ?? 0}%</div>
                </div>
              ))}
              {w.hourly.length === 0 && <div className="live-empty">{w.loading ? 'Loading hourly forecast…' : 'Hourly forecast unavailable'}</div>}
            </div>
          ) : panel === 'radar' ? (
            <LiveRadar lat={selected.lat} lon={selected.lon} />
          ) : panel === 'map' ? (
            <LiveRegionalMap lat={selected.lat} lon={selected.lon} Icon={WxIcon} count={8} zoom={6} majorOnly />
          ) : panel === 'local' ? (
            <LiveRegionalMap lat={selected.lat} lon={selected.lon} Icon={WxIcon} count={6} fit />
          ) : panel === 'extended' ? (
            <div className="live-ext">
              {days.map((d, i) => (
                <div className="live-day" key={d.p.startTime} style={{ animationDelay: `${i * 55}ms` }}>
                  <div className="live-day-name">{d.label}</div>
                  <div className="live-day-ic"><WxIcon p={d.p} size={40} color="var(--primary)" /></div>
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

        {modern && !boxAlert && (
          <div className="live-dots">
            {PANELS.map((p, i) => <span key={p.key} className={`live-dot${i === idx % PANELS.length ? ' on' : ''}`} />)}
          </div>
        )}
        </div>

        {/* Weatherscan: "Today's Forecast" bar strip as its own box BELOW the
            main panel (a sibling of .live-mainbox, sitting on the sky). */}
        {wscan && !boxAlert && w.hourly.length > 0 && (() => {
          const fc = w.hourly.slice(0, 6);
          const temps = fc.map((h) => h.temperature);
          const lo = Math.min(...temps);
          const hi = Math.max(...temps);
          return (
            <div className="live-fcstrip">
              <div className="live-fcstrip-head">{place}: Today's Forecast</div>
              <div className="live-fcstrip-row">
                {fc.map((h) => (
                  <div className="live-fc" key={h.startTime}>
                    <div className="live-fc-temp">{convertTemp(h.temperature, u)}°</div>
                    <div className="live-fc-bar" style={{ height: `${hi === lo ? 55 : Math.round(28 + ((h.temperature - lo) / (hi - lo)) * 46)}%` }} />
                    <div className="live-fc-t">{fmtHour(h.startTime)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
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
    </>
  );
}
