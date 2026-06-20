// National Weather Service API (api.weather.gov) — free, no key, CORS-enabled.

const BASE = 'https://api.weather.gov';
const HEADERS = { Accept: 'application/geo+json' };

export interface NwsPoint {
  gridId: string;
  forecastUrl: string;
  forecastHourlyUrl: string;
  city?: string;
  state?: string;
  county?: string;
  zone?: string;
  radarStation?: string;
}

export interface NwsAlert {
  id: string;
  event: string;
  severity?: string;
  headline?: string;
  description?: string;
  instruction?: string;
  onset?: string;
  ends?: string;
  areaDesc?: string;
}

export interface NwsPeriod {
  number: number;
  name: string;
  startTime: string;
  isDaytime?: boolean;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  probabilityOfPrecipitation?: { value: number | null };
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`NWS ${res.status}`);
  return res.json();
}

export async function getPoint(lat: number, lon: number): Promise<NwsPoint> {
  const data = await getJson(`${BASE}/points/${round4(lat)},${round4(lon)}`);
  const p = data.properties;
  const rel = p.relativeLocation?.properties;
  return {
    gridId: p.gridId,
    forecastUrl: p.forecast,
    forecastHourlyUrl: p.forecastHourly,
    city: rel?.city,
    state: rel?.state,
    county: typeof p.county === 'string' ? p.county.split('/').pop() : undefined,
    zone: typeof p.forecastZone === 'string' ? p.forecastZone.split('/').pop() : undefined,
    radarStation: p.radarStation,
  };
}

export async function getActiveAlerts(lat: number, lon: number): Promise<NwsAlert[]> {
  const data = await getJson(`${BASE}/alerts/active?point=${round4(lat)},${round4(lon)}`);
  const feats = Array.isArray(data.features) ? data.features : [];
  return feats.map((f: any): NwsAlert => {
    const p = f.properties ?? {};
    return {
      id: f.id ?? p.id ?? Math.random().toString(36),
      event: p.event ?? 'Alert',
      severity: p.severity,
      headline: p.headline,
      description: p.description,
      instruction: p.instruction,
      onset: p.onset,
      ends: p.ends,
      areaDesc: p.areaDesc,
    };
  });
}

export async function getForecast(url: string): Promise<NwsPeriod[]> {
  const data = await getJson(url);
  return data.properties?.periods ?? [];
}

export interface AlertGeometry { id: string; event: string; severity?: string; geometry: unknown }

// Active-alert areas for drawing on the radar map. Storm-based alerts (tornado,
// severe t-storm) carry a polygon directly; most others (advisories, watches,
// many warnings) are zone-based with geometry:null — for those we resolve their
// affected NWS zones to polygons. Zone fetches are deduped and capped.
const ZONE_CAP = 25;

export async function getAlertGeometries(lat: number, lon: number): Promise<AlertGeometry[]> {
  const data = await getJson(`${BASE}/alerts/active?point=${round4(lat)},${round4(lon)}`);
  const feats = Array.isArray(data.features) ? data.features : [];

  // Collect zones needed for alerts that lack their own polygon (capped).
  const need: string[] = [];
  for (const f of feats) {
    if (f.geometry) continue;
    for (const z of f.properties?.affectedZones ?? []) {
      if (!need.includes(z) && need.length < ZONE_CAP) need.push(z);
    }
  }
  const zoneGeom = new Map<string, unknown>();
  await Promise.allSettled(
    need.map(async (z) => {
      try {
        const zd = await getJson(z);
        if (zd.geometry) zoneGeom.set(z, zd.geometry);
      } catch { /* skip unreachable zone */ }
    })
  );

  const out: AlertGeometry[] = [];
  for (const f of feats) {
    const p = f.properties ?? {};
    const event = p.event ?? 'Alert';
    const severity = p.severity;
    if (f.geometry) {
      out.push({ id: f.id ?? Math.random().toString(36), event, severity, geometry: f.geometry });
    } else {
      for (const z of p.affectedZones ?? []) {
        const g = zoneGeom.get(z);
        if (g) out.push({ id: `${f.id ?? event}:${z}`, event, severity, geometry: g });
      }
    }
  }
  return out;
}
