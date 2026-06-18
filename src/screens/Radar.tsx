import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Play, Pause } from 'lucide-react';
import { useLocations } from '../context/LocationsContext';
import { useTheme } from '../theme/ThemeContext';

const TRANSPARENT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/QBYAAAAAElFTkSuQmCC';

// Iowa Environmental Mesonet NEXRAD base reflectivity (n0q) — real US radar, full
// zoom resolution. Current frame + 5-min-lagged frames for the animation loop.
interface Frame { suffix: string; minsAgo: number }
const FRAMES: Frame[] = [50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0].map((m) => ({
  suffix: m === 0 ? '' : `-m${String(m).padStart(2, '0')}m`,
  minsAgo: m,
}));
const tileUrl = (f: Frame) =>
  `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913${f.suffix}/{z}/{x}/{y}.png`;

export function Radar() {
  const { selected } = useLocations();
  const { scheme } = useTheme();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const radarLayerRef = useRef<L.TileLayer | null>(null);

  const [idx, setIdx] = useState(FRAMES.length - 1); // start on the current frame
  const [playing, setPlaying] = useState(true);

  const showFrame = useCallback((i: number) => {
    if (radarLayerRef.current) radarLayerRef.current.setUrl(tileUrl(FRAMES[i]));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

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

    radarLayerRef.current = L.tileLayer(tileUrl(FRAMES[FRAMES.length - 1]), {
      opacity: 0.7,
      maxNativeZoom: 14,
      maxZoom: 16,
      zIndex: 5,
      updateWhenIdle: false,
      errorTileUrl: TRANSPARENT,
      attribution: 'NEXRAD: NWS / Iowa Environmental Mesonet',
    }).addTo(map);
    setIdx(FRAMES.length - 1);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      radarLayerRef.current = null;
    };
  }, [selected.lat, selected.lon, scheme]);

  useEffect(() => { showFrame(idx); }, [idx, showFrame]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % FRAMES.length), 700);
    return () => clearInterval(t);
  }, [playing]);

  const cur = FRAMES[idx];
  const stamp = cur.minsAgo === 0 ? 'Now' : `${cur.minsAgo} min ago`;

  return (
    <div className="view fade" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
      <div className="radar-stage">
        <div id="radar-map" ref={containerRef} />
        <div className="radar-float">
          <div className="radar-pill" style={{ pointerEvents: 'auto' }}>
            <div className="ttl">Reflectivity</div>
            <div className="sub">{selected.name}</div>
          </div>
        </div>
      </div>

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
    </div>
  );
}
