import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Play, Pause, Lock } from 'lucide-react';
import { useLocations } from '../context/LocationsContext';
import { useTheme } from '../theme/ThemeContext';
import { getAlertGeometries, getActiveWarnings } from '../api/nws';
import { severityColor } from '../theme/colors';
import { useTropical } from '../hooks/useTropical';
import { category, catColor } from '../api/tropical';

const TRANSPARENT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/QBYAAAAAElFTkSuQmCC';

const IEM = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';

// Reflectivity = national mosaic, animated (current + 5-min-lagged frames).
interface Frame { suffix: string; minsAgo: number }
const FRAMES: Frame[] = [50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0].map((m) => ({
  suffix: m === 0 ? '' : `-m${String(m).padStart(2, '0')}m`,
  minsAgo: m,
}));
const refUrl = (idx: number) => `${IEM}/nexrad-n0q-900913${FRAMES[idx].suffix}/{z}/{x}/{y}.png`;

type Product = 'ref' | 'vel' | 'cc';
const PRODUCTS: { key: Product; label: string; long: string }[] = [
  { key: 'ref', label: 'Reflectivity', long: 'Base Reflectivity' },
  { key: 'vel', label: 'Velocity', long: 'Base Velocity' },
  { key: 'cc', label: 'Corr. Coeff', long: 'Correlation Coefficient' },
];

const ALERT_REFRESH_MS = 120_000; // re-fetch alert overlays every 2 min

export function Radar() {
  const { selected } = useLocations();
  const { scheme } = useTheme();
  const tropical = useTropical();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const radarLayerRef = useRef<L.TileLayer | null>(null);

  const [product, setProduct] = useState<Product>('ref');
  const [idx, setIdx] = useState(FRAMES.length - 1);
  const [playing, setPlaying] = useState(false); // open paused on the most-recent frame

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;

    const map = L.map(el, { zoomControl: true, attributionControl: true, maxZoom: 16, minZoom: 4 }).setView(
      [selected.lat, selected.lon],
      9
    );
    mapRef.current = map;

    const baseUrl =
      scheme === 'dark'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
    L.tileLayer(baseUrl, { maxNativeZoom: 16, maxZoom: 16, attribution: 'Tiles © Esri' }).addTo(map);
    L.circleMarker([selected.lat, selected.lon], {
      radius: 6, color: '#fff', weight: 2.5, fillColor: '#6E8BFF', fillOpacity: 1,
    }).addTo(map);

    const fix = () => map.invalidateSize();
    requestAnimationFrame(fix);
    const t1 = setTimeout(fix, 120);
    const t2 = setTimeout(fix, 400);
    const ro = new ResizeObserver(fix);
    ro.observe(el);

    radarLayerRef.current = L.tileLayer(refUrl(FRAMES.length - 1), {
      opacity: 0.72,
      maxNativeZoom: 14,
      maxZoom: 16,
      zIndex: 5,
      updateWhenIdle: false,
      errorTileUrl: TRANSPARENT,
      attribution: 'NEXRAD: NWS / Iowa Environmental Mesonet',
    }).addTo(map);

    // Alert overlays (local advisories + nationwide warnings) live in a layer
    // group that is re-fetched on an interval, so expired alerts drop off, new
    // ones appear, and updates are reflected — not a static one-shot draw.
    const alertGroup = L.layerGroup().addTo(map);
    const drawAlerts = async () => {
      const [local, natl] = await Promise.all([
        getAlertGeometries(selected.lat, selected.lon).catch(() => [] as Awaited<ReturnType<typeof getAlertGeometries>>),
        getActiveWarnings().catch(() => [] as Awaited<ReturnType<typeof getActiveWarnings>>),
      ]);
      if (cancelled) return;
      alertGroup.clearLayers();
      const add = (a: { event: string; severity?: string; geometry: unknown }, weight: number, fillOpacity: number) => {
        const c = severityColor(a.severity, a.event);
        L.geoJSON(a.geometry as never, { style: { color: c, weight, fillColor: c, fillOpacity } })
          .bindPopup(`<b>${a.event}</b>`)
          .addTo(alertGroup);
      };
      natl.forEach((a) => add(a, 1.4, 0.08)); // nationwide, lighter
      local.forEach((a) => add(a, 2, 0.12)); // selected area, on top
    };
    drawAlerts();
    const alertTimer = setInterval(drawAlerts, ALERT_REFRESH_MS);

    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(alertTimer);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      radarLayerRef.current = null;
    };
  }, [selected.lat, selected.lon, scheme]);

  // Overlay active tropical systems — forecast cone, track, and storm points.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tropical) return;
    const fc = (x: unknown) => ((x as any)?.features?.length ? (x as any) : null);
    const added: L.Layer[] = [];
    try {
      const cone = fc(tropical.cone);
      if (cone) added.push(L.geoJSON(cone, { style: { color: '#ffffff', weight: 1.5, fillColor: '#ffffff', fillOpacity: 0.1, dashArray: '5 4' } }).addTo(map));
      const track = fc(tropical.track);
      if (track) added.push(L.geoJSON(track, { style: { color: '#ffffff', weight: 2 } }).addTo(map));
      const points = fc(tropical.points);
      if (points) {
        added.push(
          L.geoJSON(points, {
            pointToLayer: (f: any, ll: L.LatLng) => {
              const p = f.properties || {};
              const mw = Number.isFinite(Number(p.maxwind)) ? Number(p.maxwind) : null;
              return L.circleMarker(ll, { radius: 5, color: '#fff', weight: 1.5, fillColor: catColor(category(mw, p.stormtype)), fillOpacity: 1 });
            },
            onEachFeature: (f: any, layer: L.Layer) => {
              const p = f.properties || {};
              const mw = Number.isFinite(Number(p.maxwind)) ? Number(p.maxwind) : null;
              const mph = mw != null ? Math.round(mw * 1.15078) : '?';
              layer.bindPopup(`<b>${p.stormname ?? 'Storm'}</b><br>${category(mw, p.stormtype)} · ${mph} mph`);
            },
          }).addTo(map)
        );
      }
    } catch { /* ignore overlay errors */ }
    return () => { added.forEach((l) => { try { l.remove(); } catch { /* noop */ } }); };
  }, [tropical, selected.lat, selected.lon, scheme]);

  // Reflectivity drives the live tile layer. Velocity/CC have no free map layer
  // (they need a Level III decoder backend — Phase 3), so we pull the layer off
  // the map instead of showing IEM's error tiles.
  useEffect(() => {
    const map = mapRef.current;
    const layer = radarLayerRef.current;
    if (!map || !layer) return;
    if (product === 'ref') {
      if (!map.hasLayer(layer)) layer.addTo(map);
      layer.setUrl(refUrl(idx));
    } else if (map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
  }, [product, idx]);

  useEffect(() => {
    if (product !== 'ref' || !playing) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % FRAMES.length), 700);
    return () => clearInterval(t);
  }, [product, playing]);

  const cur = FRAMES[idx];
  const stamp = cur.minsAgo === 0 ? 'Now' : `${cur.minsAgo} min ago`;
  const meta = PRODUCTS.find((p) => p.key === product)!;

  return (
    <div className="view radar-view fade" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
      <div className="radar-stage">
        <div id="radar-map" ref={containerRef} />
        <div className="radar-float">
          <div className="radar-pill" style={{ pointerEvents: 'auto' }}>
            <div className="ttl">{meta.long}</div>
            <div className="sub">{product === 'ref' ? selected.name : 'Planned · Phase 3'}</div>
          </div>
        </div>
        <div className="radar-products">
          {PRODUCTS.map((p) => (
            <button key={p.key} className={product === p.key ? 'on' : ''} onClick={() => setProduct(p.key)}>
              {p.label}
            </button>
          ))}
        </div>

        {product !== 'ref' && (
          <div className="radar-msg">
            <div className="radar-msg-card">
              <Lock size={22} />
              <div style={{ fontWeight: 700, marginTop: 8 }}>{meta.long}</div>
              <p>
                Single-radar velocity &amp; correlation-coefficient are NEXRAD Level III products — there's no free
                map layer for them. They need a small backend that decodes the raw radar feed and renders tiles, which
                is part of the Phase 3 server work. Reflectivity is fully live now.
              </p>
            </div>
          </div>
        )}
      </div>

      {product === 'ref' && (
        <div className="radar-controls">
          <button className="play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <input
            className="slider"
            type="range"
            min={0}
            max={FRAMES.length - 1}
            value={idx}
            onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }}
          />
          <div className="stamp">{stamp}</div>
        </div>
      )}
    </div>
  );
}
