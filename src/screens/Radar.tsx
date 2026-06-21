import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Play, Pause, Cloud, Loader } from 'lucide-react';
import { useLocations } from '../context/LocationsContext';
import { useTheme } from '../theme/ThemeContext';
import { getAlertGeometries, getActiveWarnings, type AlertGeometry } from '../api/nws';
import { severityColor } from '../theme/colors';
import { useTropical } from '../hooks/useTropical';
import { category, catColor } from '../api/tropical';
import { NEXRAD_SITES, nearestSite, type NexradSite } from '../data/nexradSites';
import { fetchRecentL3 } from '../api/nexrad';
import { decodeL3, type L3Data } from '../lib/nexradL3/decode';
import { L3_PRODUCTS } from '../lib/nexradL3/l3products';
import { createRadialLayer } from '../lib/nexradL3/RadialLayer';
import { L3Legend } from '../components/L3Legend';

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

// 'ref' = nationwide IEM mosaic (tiles, animated). The rest are single-site
// Level 3 products decoded + rendered client-side from the AWS bucket.
type Product = 'ref' | 'reflSite' | 'velocity' | 'srv' | 'cc' | 'zdr' | 'kdp' | 'hydro';
const PRODUCTS: { key: Product; label: string; long: string }[] = [
  { key: 'ref', label: 'Reflectivity', long: 'Base Reflectivity' },
  { key: 'reflSite', label: 'Refl (HD)', long: 'Single-Site Reflectivity' },
  { key: 'velocity', label: 'Velocity', long: 'Base Velocity' },
  { key: 'srv', label: 'Storm-Rel', long: 'Storm-Relative Velocity' },
  { key: 'cc', label: 'CC', long: 'Correlation Coefficient' },
  { key: 'zdr', label: 'ZDR', long: 'Differential Reflectivity' },
  { key: 'kdp', label: 'KDP', long: 'Specific Differential Phase' },
  { key: 'hydro', label: 'Hydro', long: 'Hydrometeor Classification' },
];

const ALERT_REFRESH_MS = 120_000; // re-fetch alert overlays every 2 min
const L3_REFRESH_MS = 150_000; // re-fetch the latest L3 scans every ~2.5 min
const L3_FRAMES = 8; // scans to load for the animation loop

// Remember the last-used radar product + tilt across sessions.
const PROD_KEY = 'auros.radar.product';
const TILT_KEY = 'auros.radar.tilt';
const VALID_PRODUCTS = new Set(PRODUCTS.map((p) => p.key));
function loadProduct(): Product {
  try {
    const v = localStorage.getItem(PROD_KEY);
    if (v && VALID_PRODUCTS.has(v as Product)) return v as Product;
  } catch { /* ignore */ }
  return 'ref';
}
function loadTilt(): number {
  try {
    const v = Number(localStorage.getItem(TILT_KEY));
    if (v >= 0 && v <= 3) return v;
  } catch { /* ignore */ }
  return 0;
}

type L3State = { status: 'idle' | 'loading' | 'ok' | 'error'; site?: string; time?: Date; msg?: string };

const escHtml = (s?: string): string =>
  (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

const fmtUntil = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
};

// Supercell-Wx-style alert detail popup: event, headline, area, expiry, and the
// call-to-action instruction.
function alertPopupHtml(a: AlertGeometry, color: string): string {
  const until = fmtUntil(a.expires);
  return (
    `<div class="alert-popup">` +
    `<div class="ap-event" style="color:${color}">${escHtml(a.event)}</div>` +
    (a.headline ? `<div class="ap-headline">${escHtml(a.headline)}</div>` : '') +
    (a.areaDesc ? `<div class="ap-area">${escHtml(a.areaDesc)}</div>` : '') +
    (until ? `<div class="ap-until">In effect until ${until}</div>` : '') +
    (a.instruction ? `<div class="ap-instruction">${escHtml(a.instruction)}</div>` : '') +
    `</div>`
  );
}

export function Radar() {
  const { selected } = useLocations();
  const { scheme } = useTheme();
  const tropical = useTropical();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const radarLayerRef = useRef<L.TileLayer | null>(null);
  const l3LayerRef = useRef<L.Layer | null>(null);
  const fittedRef = useRef<string | null>(null); // product:site we've already framed

  const [product, setProduct] = useState<Product>(loadProduct);
  const [idx, setIdx] = useState(FRAMES.length - 1);
  const [playing, setPlaying] = useState(false); // open paused on the most-recent frame
  const [satellite, setSatellite] = useState(false);
  const [l3, setL3] = useState<L3State>({ status: 'idle' });
  // Which radar site feeds the L3 products. Defaults to nearest; the user can
  // click another station's dot on the map to switch.
  const [l3Site, setL3Site] = useState<NexradSite | null>(null);
  const [tilt, setTilt] = useState(loadTilt); // elevation tilt index 0-3 (0.5° → 1.8°)
  const [l3Frames, setL3Frames] = useState<{ data: L3Data; time: Date }[]>([]);
  const [l3Idx, setL3Idx] = useState(0); // current frame in the L3 loop

  // Reset to the nearest site whenever the selected location changes.
  useEffect(() => {
    setL3Site(nearestSite(selected.lat, selected.lon));
  }, [selected.lat, selected.lon]);

  // Remember the last product + tilt across sessions.
  useEffect(() => { try { localStorage.setItem(PROD_KEY, product); } catch { /* ignore */ } }, [product]);
  useEffect(() => { try { localStorage.setItem(TILT_KEY, String(tilt)); } catch { /* ignore */ } }, [tilt]);

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
      const add = (a: AlertGeometry, weight: number, fillOpacity: number) => {
        const c = severityColor(a.severity, a.event);
        L.geoJSON(a.geometry as never, { style: { color: c, weight, fillColor: c, fillOpacity } })
          .bindPopup(alertPopupHtml(a, c), { maxWidth: 300, className: 'alert-popup-wrap' })
          .bindTooltip(a.event, { sticky: true })
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
      l3LayerRef.current = null;
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

  // Optional GOES-East infrared satellite (cloud cover) beneath the radar.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !satellite) return;
    const layer = L.tileLayer(`${IEM}/goes_east_conus_ch13/{z}/{x}/{y}.png`, {
      opacity: 0.55,
      zIndex: 3,
      className: 'sat-ir',
      maxNativeZoom: 9,
      maxZoom: 16,
      errorTileUrl: TRANSPARENT,
      attribution: 'GOES-East: NOAA / Iowa Environmental Mesonet',
    }).addTo(map);
    return () => { try { map.removeLayer(layer); } catch { /* noop */ } };
  }, [satellite, selected.lat, selected.lon, scheme]);

  // Reflectivity drives the live IEM tile layer (nationwide, animated).
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

  // Level-3 products: fetch the last few scans for the selected site/product/
  // tilt, decode them into a loop, and frame the radar's coverage. Rendering of
  // the current frame happens in the effect below; this one only loads data.
  useEffect(() => {
    if (product === 'ref') { setL3({ status: 'idle' }); setL3Frames([]); fittedRef.current = null; return; }
    const def = L3_PRODUCTS[product];
    const map = mapRef.current;
    if (!def || !l3Site || !map) { setL3Frames([]); return; }

    let cancelled = false;
    const site = l3Site;
    setL3({ status: 'loading', site: site.id });
    const tiltProd = def.prod[0] + tilt + def.prod.slice(2); // N0G → N2G for tilt 2

    const load = async () => {
      try {
        const fetched = await fetchRecentL3(site.id, tiltProd, L3_FRAMES);
        if (cancelled) return;
        if (!fetched.length) { setL3Frames([]); setL3({ status: 'error', site: site.id, msg: 'No recent scan available' }); return; }
        const decoded = await Promise.all(
          fetched.map(async (f) => {
            try { return { data: await decodeL3(f.data), time: f.time }; } catch { return null; }
          })
        );
        if (cancelled) return;
        const frames = decoded.filter((d): d is { data: L3Data; time: Date } => d !== null);
        if (!frames.length) { setL3Frames([]); setL3({ status: 'error', site: site.id, msg: 'Could not decode scans' }); return; }
        setL3Frames(frames);
        setL3Idx(frames.length - 1);
        setL3({ status: 'ok', site: site.id, time: frames[frames.length - 1].time });

        // Frame the radar's coverage once per product/site (not on refresh, not
        // on tilt change) so the disc fits without yanking the view.
        const fitKey = `${product}:${site.id}`;
        if (fittedRef.current !== fitKey && mapRef.current) {
          fittedRef.current = fitKey;
          const d0 = frames[frames.length - 1].data;
          const rangeKm = d0.gateKm * (d0.radials[0]?.bins.length || 920) * 1.05;
          const dLat = rangeKm / 111;
          const dLon = rangeKm / (111 * Math.cos((d0.radarLat * Math.PI) / 180));
          mapRef.current.fitBounds(
            [[d0.radarLat - dLat, d0.radarLon - dLon], [d0.radarLat + dLat, d0.radarLon + dLon]],
            { animate: true, padding: [20, 20] }
          );
        }
      } catch (e) {
        if (cancelled) return;
        setL3Frames([]);
        setL3({ status: 'error', site: site.id, msg: (e as Error).message });
      }
    };
    load();
    const timer = setInterval(load, L3_REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [product, l3Site, tilt, scheme]);

  // Render the current L3 frame onto the map (also handles create/teardown).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const removeLayer = () => {
      if (l3LayerRef.current) {
        try { map.removeLayer(l3LayerRef.current); } catch { /* noop */ }
        l3LayerRef.current = null;
      }
    };
    const def = product !== 'ref' ? L3_PRODUCTS[product] : null;
    const frame = l3Frames[Math.min(l3Idx, l3Frames.length - 1)];
    if (!def || !frame) { removeLayer(); return; }
    if (l3LayerRef.current && map.hasLayer(l3LayerRef.current)) {
      (l3LayerRef.current as unknown as { setData: (d: L3Data, p: typeof def) => void }).setData(frame.data, def);
    } else {
      removeLayer();
      l3LayerRef.current = createRadialLayer(frame.data, def, 0.72);
      l3LayerRef.current.addTo(map);
    }
  }, [l3Frames, l3Idx, product, scheme]);

  // Animate the L3 loop when playing.
  useEffect(() => {
    if (product === 'ref' || !playing || l3Frames.length < 2) return;
    const t = setInterval(() => setL3Idx((i) => (i + 1) % l3Frames.length), 700);
    return () => clearInterval(t);
  }, [product, playing, l3Frames.length]);

  // Radar-station dots (L3 products only) — click one to switch which radar the
  // velocity/etc. is read from. Live in markerPane so they sit above the radial
  // canvas and stay clickable.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || product === 'ref') return;
    const group = L.layerGroup().addTo(map);
    NEXRAD_SITES.forEach((s) => {
      const active = !!l3Site && s.id === l3Site.id;
      const size = active ? 20 : 12;
      const marker = L.marker([s.lat, s.lon], {
        title: `${s.id} · ${s.name}`,
        icon: L.divIcon({
          className: '',
          html: `<div class="radar-site-dot${active ? ' active' : ''}"></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
        zIndexOffset: active ? 1000 : 0,
      });
      marker.on('click', () => setL3Site(s));
      marker.addTo(group);
    });
    return () => { try { map.removeLayer(group); } catch { /* noop */ } };
  }, [product, l3Site, scheme]);

  const cur = FRAMES[idx];
  const stamp = cur.minsAgo === 0 ? 'Now' : `${cur.minsAgo} min ago`;
  const meta = PRODUCTS.find((p) => p.key === product)!;
  const l3def = product !== 'ref' ? L3_PRODUCTS[product] : null;
  const curFrame = l3Frames[Math.min(l3Idx, Math.max(0, l3Frames.length - 1))];
  const scanStamp = curFrame
    ? curFrame.time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';

  const pillSub =
    product === 'ref'
      ? selected.name
      : l3.status === 'loading'
        ? `Loading ${l3.site ?? ''}…`
        : l3.status === 'ok'
          ? `${l3.site} · ${scanStamp}`
          : l3.status === 'error'
            ? `${l3.site}: ${l3.msg}`
            : l3.site ?? '';

  return (
    <div className="view radar-view fade" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
      <div className="radar-stage">
        <div id="radar-map" ref={containerRef} />
        <div className="radar-float">
          <div className="radar-pill" style={{ pointerEvents: 'auto' }}>
            <div className="ttl">{meta.long}</div>
            <div className="sub">{pillSub}</div>
          </div>
        </div>
        <div className="radar-products">
          {PRODUCTS.map((p) => (
            <button key={p.key} className={product === p.key ? 'on' : ''} onClick={() => setProduct(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        <button className={`radar-sat ${satellite ? 'on' : ''}`} onClick={() => setSatellite((s) => !s)}>
          <Cloud size={13} /> Satellite
        </button>
        {satellite && (
          <div className="radar-sat-legend">Infrared satellite · bright = colder, higher cloud tops (storms)</div>
        )}

        {l3def && (
          <div className="radar-tilts">
            <div className="rt-label">Tilt</div>
            {['0.5°', '0.9°', '1.3°', '1.8°'].map((lbl, i) => (
              <button key={i} className={tilt === i ? 'on' : ''} onClick={() => setTilt(i)}>{lbl}</button>
            ))}
          </div>
        )}

        {l3def && l3.status === 'loading' && (
          <div className="radar-l3-badge">
            <Loader size={13} className="spin" /> Decoding {l3def.label.toLowerCase()}…
          </div>
        )}
        {l3def && l3.status === 'ok' && <L3Legend def={l3def} />}
        {l3def && l3.status === 'error' && (
          <div className="radar-msg">
            <div className="radar-msg-card">
              <div style={{ fontWeight: 700 }}>{l3def.label} unavailable</div>
              <p>
                Couldn’t load {l3def.label.toLowerCase()} from {l3.site}. {l3.msg}. The site may be in
                clear-air mode or briefly offline — reflectivity stays live.
              </p>
            </div>
          </div>
        )}
      </div>

      {product === 'ref' ? (
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
      ) : l3Frames.length > 1 ? (
        <div className="radar-controls">
          <button className="play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <input
            className="slider"
            type="range"
            min={0}
            max={l3Frames.length - 1}
            value={Math.min(l3Idx, l3Frames.length - 1)}
            onChange={(e) => { setPlaying(false); setL3Idx(Number(e.target.value)); }}
          />
          <div className="stamp">{scanStamp}</div>
        </div>
      ) : null}
    </div>
  );
}
