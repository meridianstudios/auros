// NOAA / National Hurricane Center tropical data via ArcGIS REST — CORS-enabled,
// returns GeoJSON, free, no key. The "summary" service consolidates every active
// Atlantic / E-Pacific / C-Pacific storm into single layers:
//   5 Forecast Points · 6 Forecast Track · 7 Forecast Cone
const SVC =
  'https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather_summary/MapServer';
const layerUrl = (id: number) => `${SVC}/${id}/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`;

export interface TropicalStorm {
  name: string;
  type: string; // e.g. "Hurricane", "Tropical Storm"
  category: string; // "Cat 3", "TS", "TD", "PTC"…
  maxWindMph: number | null;
  pressure: number | null; // mb
  moveDir: number | null; // degrees
  moveSpeedMph: number | null;
  lat: number;
  lon: number;
}

export interface Tropical {
  storms: TropicalStorm[];
  points: unknown | null; // raw GeoJSON, for the radar overlay
  track: unknown | null;
  cone: unknown | null;
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const KT_TO_MPH = 1.15078;

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export function compass(deg: number | null): string {
  if (deg == null) return '';
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

// Saffir-Simpson from max sustained wind (knots).
export function category(maxWindKt: number | null, stormType = ''): string {
  const t = stormType.toLowerCase();
  if (t.includes('potential')) return 'PTC';
  if (t.includes('post')) return 'Post-TC';
  const sub = t.includes('subtropical');
  if (maxWindKt == null) return stormType || '';
  if (maxWindKt < 34) return sub ? 'SD' : 'TD';
  if (maxWindKt < 64) return sub ? 'SS' : 'TS';
  if (maxWindKt < 83) return 'Cat 1';
  if (maxWindKt < 96) return 'Cat 2';
  if (maxWindKt < 113) return 'Cat 3';
  if (maxWindKt < 137) return 'Cat 4';
  return 'Cat 5';
}

export function catColor(cat: string): string {
  if (/Cat 5/.test(cat)) return '#C084FC';
  if (/Cat 4/.test(cat)) return '#E11D48';
  if (/Cat 3/.test(cat)) return '#FB7185';
  if (/Cat [12]/.test(cat)) return '#FB923C';
  if (/TS|SS/.test(cat)) return '#FBBF24';
  return '#6E8BFF'; // TD / PTC / Post-TC / unknown
}

function parseStorms(gj: any): TropicalStorm[] {
  const byName = new Map<string, TropicalStorm & { _tau: number }>();
  for (const f of gj.features ?? []) {
    const p = f.properties ?? {};
    const name = p.stormname;
    if (!name) continue;
    const tau = num(p.tau) ?? 0; // current position has the smallest tau
    const prev = byName.get(name);
    if (prev && tau >= prev._tau) continue;
    const coords = f.geometry?.coordinates;
    const maxWindKt = num(p.maxwind);
    byName.set(name, {
      _tau: tau,
      name,
      type: p.stormtype || '',
      category: category(maxWindKt, p.stormtype),
      maxWindMph: maxWindKt != null ? Math.round(maxWindKt * KT_TO_MPH) : null,
      pressure: num(p.mslp),
      moveDir: num(p.tcdir),
      moveSpeedMph: num(p.tcspd) != null ? Math.round((num(p.tcspd) as number) * KT_TO_MPH) : null,
      lat: (Array.isArray(coords) ? num(coords[1]) : num(p.lat)) ?? 0,
      lon: (Array.isArray(coords) ? num(coords[0]) : num(p.lon)) ?? 0,
    });
  }
  return [...byName.values()].map(({ _tau, ...s }) => s);
}

export async function getTropical(): Promise<Tropical> {
  const [pts, track, cone] = await Promise.allSettled([
    fetch(layerUrl(5)).then((r) => r.json()),
    fetch(layerUrl(6)).then((r) => r.json()),
    fetch(layerUrl(7)).then((r) => r.json()),
  ]);
  const points = pts.status === 'fulfilled' ? pts.value : null;
  return {
    storms: points?.features?.length ? parseStorms(points) : [],
    points,
    track: track.status === 'fulfilled' ? track.value : null,
    cone: cone.status === 'fulfilled' ? cone.value : null,
  };
}
