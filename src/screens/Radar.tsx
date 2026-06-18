import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Play, Pause } from 'lucide-react';
import { useLocations } from '../context/LocationsContext';
import { useTheme } from '../theme/ThemeContext';
import { getPoint } from '../api/nws';

const TRANSPARENT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/QBYAAAAAElFTkSuQmCC';

const IEM = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0';

// Reflectivity = national mosaic, animated (current + 5-min-lagged frames).
interface Frame { suffix: string; minsAgo: number }
const FRAMES: Frame[] = [50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0].map((m) => ({
  suffix: m === 0 ? '' : `-m${String(m).padStart(2, '0')}m`,
  minsAgo: m,
}));

type Product = 'ref' | 'vel' | 'cc';
const PRODUCTS: { key: Product; label: string; long: string }[] = [
  { key: 'ref', label: 'Reflectivity', long: 'Base Reflectivity' },
  { key: 'vel', label: 'Velocity', long: 'Base Velocity' },
  { key: 'cc', label: 'Corr. Coeff', long: 'Correlation Coefficient' },
];

function frameUrl(product: Product, idx: number, site: string): string {
  if (product === 'ref') return `${IEM}/nexrad-n0q-900913${FRAMES[idx].suffix}/{z}/{x}/{y}.png`;
  const prod = product === 'vel' ? 'N0U' : 'N0C'; // single-radar Level III, latest scan
  return `${IEM}/ridge::${site}-${prod}-0/{z}/{x}/{y}.png`;
}

export function Radar() {
  const { selected } = useLocations();
  const { scheme } = useTheme();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const radarLayerRef = useRef<L.TileLayer | null>(null);

  const [product, setProduct] = useState<Product>('ref');
  const [idx, setIdx] = useState(FRAMES.length - 1);
  const [playing, setPlaying] = useState(true);
  const [site, setSite] = useState('KIWX');

  // Build the map (re-runs on location / theme change).
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

    radarLayerRef.current = L.tileLayer(frameUrl('ref', FRAMES.length - 1, 'KIWX'), {
      opacity: 0.72,
      maxNativeZoom: 14,
      maxZoom: 16,
      zIndex: 5,
      updateWhenIdle: false,
      errorTileUrl: TRANSPARENT,
      attribution: 'NEXRAD: NWS / Iowa Environmental Mesonet',
    }).addTo(map);

    // Nearest radar for the single-site (velocity / CC) products.
    getPoint(selected.lat, selected.lon)
      .then((p) => { if (!cancelled && p.radarStation) setSite(p.radarStation); })
      .catch(() => {});

    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      radarLayerRef.current = null;
    };
  }, [selected.lat, selected.lon, scheme]);

  // Update the layer whenever product / frame / radar changes.
  useEffect(() => {
    radarLayerRef.current?.setUrl(frameUrl(product, idx, site));
  }, [product, idx, site]);

  // Animate reflectivity only.
  useEffect(() => {
    if (product !== 'ref' || !playing) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % FRAMES.length), 700);
    return () => clearInterval(t);
  }, [product, playing]);

  const cur = FRAMES[idx];
  const stamp = cur.minsAgo === 0 ? 'Now' : `${cur.minsAgo} min ago`;
  const meta = PRODUCTS.find((p) => p.key === product)!;

  return (
    <div className="view fade" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
      <div className="radar-stage">
        <div id="radar-map" ref={containerRef} />
        <div className="radar-float">
          <div className="radar-pill" style={{ pointerEvents: 'auto' }}>
            <div className="ttl">{meta.long}</div>
            <div className="sub">{product === 'ref' ? selected.name : `${site} · latest scan`}</div>
          </div>
        </div>
        <div className="radar-products">
          {PRODUCTS.map((p) => (
            <button key={p.key} className={product === p.key ? 'on' : ''} onClick={() => setProduct(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="radar-controls">
        {product === 'ref' ? (
          <>
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
          </>
        ) : (
          <div className="muted" style={{ width: '100%', textAlign: 'center', fontSize: 13 }}>
            {meta.long} · {site} · most recent scan
          </div>
        )}
      </div>
    </div>
  );
}
