import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useLocations } from '../context/LocationsContext';
import { useTheme } from '../theme/ThemeContext';
import { getRadar } from '../api/rainviewer';

export function Radar() {
  const { selected } = useLocations();
  const { scheme } = useTheme();
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ts, setTs] = useState('Loading…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    const el = containerRef.current;
    if (!el) return;

    const map = L.map(el, { zoomControl: true, attributionControl: true }).setView([selected.lat, selected.lon], 8);
    mapRef.current = map;

    const baseUrl =
      scheme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    L.tileLayer(baseUrl, { maxZoom: 12, subdomains: 'abcd', attribution: '© OpenStreetMap, © CARTO' }).addTo(map);
    L.circleMarker([selected.lat, selected.lon], { radius: 6, color: '#7C8CFF', weight: 3, fillColor: '#fff', fillOpacity: 1 }).addTo(map);

    getRadar()
      .then((radar) => {
        if (cancelled) return;
        const frames = radar.frames.slice(-13);
        const layers = frames.map((f) =>
          L.tileLayer(`${radar.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: 0, zIndex: 5 }).addTo(map)
        );
        let i = 0;
        const show = (idx: number) => {
          layers.forEach((l, k) => l.setOpacity(k === idx ? 0.72 : 0));
          const f = frames[idx];
          const d = new Date(f.time * 1000);
          setTs((f.nowcast ? 'FORECAST ' : '') + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
        };
        if (frames.length) {
          show(0);
          timer = setInterval(() => { i = (i + 1) % frames.length; show(i); }, 650);
        } else {
          setTs('No radar data');
        }
      })
      .catch((e) => !cancelled && setError(e?.message ?? 'Radar unavailable'));

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      map.remove();
      mapRef.current = null;
    };
  }, [selected.lat, selected.lon, scheme]);

  return (
    <div className="view" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
      <div className="bar">
        <h1>Radar — Reflectivity</h1>
        <p>{selected.name} · live loop + short-term forecast · {ts}</p>
      </div>
      <div className="radar-wrap">
        {error ? <div className="center" style={{ color: 'var(--danger)' }}>{error}</div> : <div id="radar-map" ref={containerRef} />}
      </div>
      <div className="radar-bar">Velocity &amp; correlation-coefficient products arrive in Phase 3 (backend renderer).</div>
    </div>
  );
}
