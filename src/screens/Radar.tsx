import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Play, Pause } from 'lucide-react';
import { useLocations } from '../context/LocationsContext';
import { useTheme } from '../theme/ThemeContext';
import { getRadar, type RadarFrame } from '../api/rainviewer';

export function Radar() {
  const { selected } = useLocations();
  const { scheme } = useTheme();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<(L.TileLayer | null)[]>([]);
  const framesRef = useRef<RadarFrame[]>([]);
  const hostRef = useRef('');

  const [frames, setFrames] = useState<RadarFrame[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create a frame's tile layer only when first needed (keeps it cached after).
  const ensureLayer = useCallback((i: number) => {
    const map = mapRef.current;
    const f = framesRef.current[i];
    if (!map || !f) return;
    if (layersRef.current[i]) return;
    layersRef.current[i] = L.tileLayer(`${hostRef.current}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, {
      opacity: 0,
      maxNativeZoom: 10, // RainViewer radar resolution; upscales when zoomed past this
      maxZoom: 18,
      zIndex: 5,
      updateWhenIdle: false,
      className: 'radar-tiles',
    }).addTo(map);
  }, []);

  const showFrame = useCallback((i: number) => {
    ensureLayer(i);
    layersRef.current.forEach((l, k) => l && l.setOpacity(k === i ? 0.82 : 0));
  }, [ensureLayer]);

  // Build map + load radar metadata (re-runs on location / theme change).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;

    const map = L.map(el, { zoomControl: true, attributionControl: true, maxZoom: 18, minZoom: 4 }).setView(
      [selected.lat, selected.lon],
      8
    );
    mapRef.current = map;

    const baseUrl =
      scheme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    L.tileLayer(baseUrl, { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap, © CARTO' }).addTo(map);
    L.circleMarker([selected.lat, selected.lon], {
      radius: 6, color: '#fff', weight: 2.5, fillColor: '#6E8BFF', fillOpacity: 1,
    }).addTo(map);

    const fix = () => map.invalidateSize();
    requestAnimationFrame(fix);
    const t1 = setTimeout(fix, 120);
    const t2 = setTimeout(fix, 400);
    const ro = new ResizeObserver(fix);
    ro.observe(el);

    layersRef.current = [];
    getRadar()
      .then((radar) => {
        if (cancelled) return;
        const fr = radar.frames.slice(-12);
        framesRef.current = fr;
        hostRef.current = radar.host;
        layersRef.current = fr.map(() => null);
        setFrames(fr);
        if (!fr.length) { setError('No radar data available'); return; }
        const firstNow = fr.findIndex((f) => f.nowcast);
        const start = firstNow > 0 ? firstNow - 1 : firstNow === 0 ? 0 : fr.length - 1;
        setIdx(start);
        showFrame(start);
      })
      .catch((e) => !cancelled && setError(e?.message ?? 'Radar unavailable'));

    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layersRef.current = [];
      framesRef.current = [];
    };
  }, [selected.lat, selected.lon, scheme, showFrame]);

  // Reflect the active frame.
  useEffect(() => {
    if (frames.length) showFrame(idx);
  }, [idx, frames.length, showFrame]);

  // Playback loop (one new frame per tick = gentle tile loading, no rate-limit storm).
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % frames.length), 900);
    return () => clearInterval(t);
  }, [playing, frames.length]);

  const cur = frames[idx];
  const stamp = cur ? new Date(cur.time * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

  return (
    <div className="view fade" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
      <div className="radar-stage">
        {error ? (
          <div className="center" style={{ color: 'var(--danger)' }}>{error}</div>
        ) : (
          <div id="radar-map" ref={containerRef} />
        )}
        <div className="radar-float">
          <div className="radar-pill" style={{ pointerEvents: 'auto' }}>
            <div className="ttl">Reflectivity</div>
            <div className="sub">{selected.name}</div>
          </div>
        </div>
      </div>

      {!error && frames.length > 0 && (
        <div className="radar-controls">
          <button className="play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <input
            className="slider"
            type="range"
            min={0}
            max={frames.length - 1}
            value={idx}
            onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }}
          />
          <div className="stamp">
            {stamp}
            {cur?.nowcast && <span className="fc"> · fc</span>}
          </div>
        </div>
      )}
    </div>
  );
}
