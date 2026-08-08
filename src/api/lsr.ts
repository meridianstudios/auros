// Local Storm Reports (LSRs) — the NWS's official observed-weather reports (hail
// size, wind damage, tornadoes, flooding…), via the Iowa Environmental Mesonet
// GeoJSON service (the same source the radar tiles come from). Authoritative, so
// it works no matter how small the app's userbase is — no crowd-sourcing needed.

import { haversineMiles } from '../utils/geo';

export interface Lsr {
  id: string;
  valid: string; // ISO time issued
  typetext: string; // e.g. "HAIL", "TSTM WND GST", "FLASH FLOOD"
  magf: number | null; // numeric magnitude (hail inches / wind mph), or null
  unit: string | null; // "MPH" | "Inch" | null
  city?: string; // relative location, e.g. "3 NE Bronson"
  state?: string;
  source?: string; // who reported it (public, trained spotter, mesonet…)
  remark?: string;
  lat: number;
  lon: number;
}

// Storm reports within ~125 mi of the point over the last `hours`, newest first.
// IEM's server-side bbox filter is unreliable alongside `hours`, so we pull the
// national feed and filter by distance here — bulletproof. Routine rain-gauge
// ("RAIN") reports are dropped so this stays a storm feed.
const RADIUS_MI = 80;

export async function getLsrs(lat: number, lon: number, hours = 24): Promise<Lsr[]> {
  const res = await fetch(`https://mesonet.agron.iastate.edu/geojson/lsr.geojson?hours=${hours}`);
  if (!res.ok) throw new Error(`LSR ${res.status}`);
  const data = await res.json();
  const feats: any[] = Array.isArray(data.features) ? data.features : [];
  return feats
    .map((f, i): Lsr => {
      const p = f.properties ?? {};
      const g = f.geometry?.coordinates ?? [];
      return {
        id: `${p.product_id ?? 'lsr'}-${i}`,
        valid: p.valid,
        typetext: p.typetext || 'Report',
        magf: typeof p.magf === 'number' ? p.magf : null,
        unit: p.unit || null,
        city: p.city,
        state: p.state || p.st,
        source: p.source,
        remark: p.remark,
        lat: g[1],
        lon: g[0],
      };
    })
    .filter((l) => l.lat != null && l.lon != null
      && (l.typetext || '').toUpperCase() !== 'RAIN'
      && haversineMiles(lat, lon, l.lat, l.lon) <= RADIUS_MI)
    .sort((a, b) => (b.valid || '').localeCompare(a.valid || ''));
}
