// Shared metadata for NWS alerts: a type icon, a tier label (Warning/Watch/…),
// and an urgency rank for sorting. Keeps the Alerts screen and the home alert
// cards reading the same way.
import { Tornado, CloudLightning, CloudHail, Waves, Snowflake, ThermometerSun, Wind, CloudFog, Flame, Zap, TriangleAlert, type LucideIcon } from 'lucide-react';

export function alertIcon(event = ''): LucideIcon {
  const e = event.toLowerCase();
  if (e.includes('tornado')) return Tornado;
  if (e.includes('thunderstorm') || e.includes('severe weather')) return CloudLightning;
  if (e.includes('flood') || e.includes('hydrologic') || e.includes('coastal') || e.includes('marine') || e.includes('surge') || e.includes('tsunami')) return Waves;
  if (e.includes('winter') || e.includes('snow') || e.includes('blizzard') || e.includes('ice') || e.includes('freeze') || e.includes('frost') || e.includes('chill')) return Snowflake;
  if (e.includes('heat')) return ThermometerSun;
  if (e.includes('wind') || e.includes('gale')) return Wind;
  if (e.includes('fog')) return CloudFog;
  if (e.includes('fire') || e.includes('red flag')) return Flame;
  if (e.includes('hurricane') || e.includes('tropical')) return CloudLightning;
  return TriangleAlert;
}

// The kind of product, for the little badge on each card.
export function alertTier(event = ''): string {
  const e = event.toLowerCase();
  if (e.includes('warning')) return 'Warning';
  if (e.includes('watch')) return 'Watch';
  if (e.includes('advisory')) return 'Advisory';
  if (e.includes('statement')) return 'Statement';
  if (e.includes('emergency')) return 'Emergency';
  return 'Alert';
}

// Higher = more urgent. Sorts the loudest hazards to the top of the list.
export function alertRank(event = ''): number {
  const e = event.toLowerCase();
  if (e.includes('tornado warning')) return 6;
  if (e.includes('severe thunderstorm warning') || e.includes('flash flood warning')) return 5;
  if (e.includes('warning')) return 4;
  if (e.includes('watch')) return 3;
  if (e.includes('advisory')) return 2;
  return 1;
}

// ---- Local Storm Reports (LSRs) ----

export function lsrIcon(typetext = ''): LucideIcon {
  const t = typetext.toLowerCase();
  if (t.includes('tornado') || t.includes('funnel') || t.includes('spout')) return Tornado;
  if (t.includes('hail')) return CloudHail;
  if (t.includes('flood') || t.includes('rain') || t.includes('flood')) return Waves;
  if (t.includes('wnd') || t.includes('wind') || t.includes('gust') || t.includes('downburst') || t.includes('gale')) return Wind;
  if (t.includes('snow') || t.includes('ice') || t.includes('sleet') || t.includes('freez') || t.includes('blizzard')) return Snowflake;
  if (t.includes('lightn')) return Zap;
  if (t.includes('tstm') || t.includes('thunder')) return CloudLightning;
  return TriangleAlert;
}

export function lsrColor(typetext = ''): string {
  const t = typetext.toLowerCase();
  if (t.includes('tornado') || t.includes('funnel') || t.includes('spout')) return '#FF4438';
  if (t.includes('hail')) return '#38BDF8';
  if (t.includes('flood') || t.includes('rain')) return '#22C55E';
  if (t.includes('snow') || t.includes('ice') || t.includes('sleet') || t.includes('freez')) return '#93C5FD';
  if (t.includes('wnd') || t.includes('wind') || t.includes('gust') || t.includes('downburst') || t.includes('gale')) return '#FBBF24';
  return '#FB923C';
}

// "1.50\" Hail", "Thunderstorm Wind Gust 60 mph", "Flash Flood".
export function lsrLabel(typetext = '', magf?: number | null, unit?: string | null): string {
  let t = typetext.toLowerCase()
    .replace(/tstm/g, 'thunderstorm').replace(/\bwnd\b/g, 'wind')
    .replace(/\bgst\b/g, 'gust').replace(/\bdmg\b/g, 'damage')
    .replace(/\bmrn\b/g, 'marine').replace(/\bnon /g, 'non-');
  t = t.replace(/\b\w/g, (c) => c.toUpperCase());
  if (magf != null && unit) {
    if (/inch/i.test(unit)) return `${magf.toFixed(2)}" ${t}`;
    return `${t} ${Math.round(magf)} ${unit.toLowerCase()}`;
  }
  return t;
}
