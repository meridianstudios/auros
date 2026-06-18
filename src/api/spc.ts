// SPC categorical convective outlook via GeoJSON + point-in-polygon.
// Note: if spc.noaa.gov blocks cross-origin requests, this throws and the UI
// degrades gracefully (risk shown as unavailable). A Phase-3 backend proxy fixes that.

import { getRiskMeta, type RiskMeta } from '../theme/colors';
import { pointInGeometry } from '../utils/geo';

const url = (day: number) =>
  `https://www.spc.noaa.gov/products/outlook/day${day}otlk_cat.nolyr.geojson`;

export interface SpcRisk {
  day: number;
  risk: RiskMeta | null;
}

export async function getDayRisk(lat: number, lon: number, day = 1): Promise<SpcRisk> {
  const res = await fetch(url(day));
  if (!res.ok) throw new Error(`SPC ${res.status}`);
  const data = await res.json();
  const feats: any[] = Array.isArray(data.features) ? data.features : [];
  let best: RiskMeta | null = null;
  for (const f of feats) {
    const meta = getRiskMeta(f.properties?.LABEL);
    if (!meta) continue;
    if (best && meta.level <= best.level) continue;
    if (pointInGeometry(lon, lat, f.geometry)) best = meta;
  }
  return { day, risk: best };
}
