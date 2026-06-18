import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useLocations } from '../context/LocationsContext';
import { useTheme } from '../theme/ThemeContext';
import { getRadar } from '../api/rainviewer';

export function Radar() {
  const { selected } = useLocations();
  const { scheme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ts, setTs] = useState('Loading radar…');
  const [forecast, setForecast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const map = L.map(el, { zoomControl: true, attributionControl: true, fadeAnimation: true }).setView(
      [selected.lat, selected.lon],
      8
    );

    const baseUrl =
      scheme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    L.tileLayer(baseUrl, { maxZoom: 12, subdomains: 'abcd', attribution: '© OpenStreetMap, © CARTO' }).addTo(map);
    L.circleMarker([selected.lat, selected.lon], {
      radius: 6, color: '#fff', weight: 2.5, fillColor: '#6E8BFF', fillOpacity: 1,
    }).addTo(map);

    // Leaflet often mis-measures a flex/absolute container on first paint → fix it.
    const fix = () => map.invalidateSize();
    requestAnimationFrame(fix);
    const t1 = setTimeout(fix, 120);
    const t2 = setTimeout(fix, 400);
    const ro = new ResizeObserver(fix);
    ro.observe(el);

    getRadar()
      .then((radar) => {
        if (cancelled) return;
        const frames = radar.frames.slice(-10);
        if (!frames.length) { setTs('No radar data'); return; }
        // Lazy: create one tile layer per frame ONLY when first shown. This spreads
        // tile requests over time instead of bursting 200+ at once (avoids HTTP 429).
        const layers: (L.TileLayer | null)[] = frames.map(() => null);
        let i = 0;
        const show = (idx: number) => {
          if (!layers[idx]) {
            layers[idx] = L.tileLayer(`${radar.host}${frames[idx].path}/256/{z}/{x}/{y}/2/1_1.png`, {
              opacity: 0, maxZoom: 12, zIndex: 5, updateWhenIdle: true, keepBuffer: 0,
            }).addTo(map);
          }
          layers.forEach((l, k) => l && l.setOpacity(k === idx ? 0.82 : 0));
          const f = frames[idx];
          setForecast(f.nowcast);
          setTs(new Date(f.time * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
        };
        show(0);
        timer = setInterval(() => { i = (i + 1) % frames.length; show(i); }, 850);
      })
      .catch((e) => !cancelled && setError(e?.message ?? 'Radar unavailable'));

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      clearTimeout(t1); clearTimeout(t2);
      ro.disconnect();
      map.remove();
    };
  }, [selected.lat, selected.lon, scheme]);

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
          <div className="radar-pill radar-ts">{ts}{forecast ? ' · forecast' : ''}</div>
        </div>
        <div className="radar-note">Velocity &amp; correlation-coefficient products arrive in Phase 3</div>
      </div>
    </div>
  );
}
