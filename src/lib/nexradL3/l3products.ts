// NEXRAD Level 3 products wired into the radar UI. `kind` controls how a decoded
// bin value is interpreted: 'value' = physical units, 'level' = run-length level
// index (0 = no data). Each has a color function bin-value -> CSS color (or null
// for transparent / below threshold).

export type L3Kind = 'value' | 'level';

export interface L3ProductDef {
  key: string;
  label: string;
  short: string;
  prod: string; // bucket product code, e.g. N0G
  kind: L3Kind;
  units: string;
  legend: string; // short caption shown under the radar
  /** value range sampled for the legend gradient + axis labels (left→right) */
  scale?: { range: [number, number]; labels: string[] };
  /** categorical legend (e.g. hydrometeor) instead of a gradient */
  categories?: { color: string; label: string }[];
  /** convert a stored value to the number shown to the user (e.g. m/s -> kt) */
  display?: (v: number) => number;
  color: (v: number) => string | null;
}

// Build a left→right CSS gradient by sampling a product's color function across
// its scale range (used by the legend bar).
export function legendGradient(def: L3ProductDef, steps = 28): string {
  if (!def.scale) return 'transparent';
  const [lo, hi] = def.scale.range;
  const stops: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const v = lo + ((hi - lo) * i) / steps;
    const c = def.color(v) || 'transparent';
    stops.push(`${c} ${((100 * i) / steps).toFixed(1)}%`);
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

// ---- Reflectivity (single-site super-res, N0B) — classic NWS dBZ palette ----
const REFL_STOPS: [number, string][] = [
  [5, '#04e9e7'], [10, '#019ff4'], [15, '#0300f4'], [20, '#02fd02'], [25, '#01c501'],
  [30, '#008e00'], [35, '#fdf802'], [40, '#e5bc00'], [45, '#fd9500'], [50, '#fd0000'],
  [55, '#d40000'], [60, '#bc0000'], [65, '#f800fd'], [70, '#9854c6'], [75, '#fdfdfd'],
];
function reflColor(dbz: number): string | null {
  if (dbz < 5) return null;
  let c = REFL_STOPS[0][1];
  for (const [t, col] of REFL_STOPS) {
    if (dbz >= t) c = col; else break;
  }
  return c;
}

// ---- Velocity (N0G) — green toward the radar, red away, brightness scaling
// with speed (like Supercell-Wx). It is ALWAYS coloured — grey appears only on
// the thin zero-velocity line where inbound meets outbound, not as a resting
// zone. ----
const VEL_MAX = 42; // m/s for full brightness
const VEL_ZERO = 1; // |v| below this = the zero isodop (grey)
function velColor(ms: number): string | null {
  if (Math.abs(ms) < VEL_ZERO) return 'rgb(120,120,120)'; // inbound meets outbound
  const a = Math.min(Math.abs(ms) / VEL_MAX, 1);
  const main = Math.round(110 + 145 * a); // 110 (weak) -> 255 (strong)
  const side = Math.round(18 + 26 * a);
  if (ms < 0) return `rgb(${side},${main},${side})`; // inbound -> green
  return `rgb(${main},${side},${side})`; // outbound -> red
}

// ---- Storm-relative velocity (N0S) — 16 run-length levels; grey only on the
// center (level 8) zero line, solid green/red otherwise. ----
function srvColor(level: number): string | null {
  if (level === 0) return null;
  if (level >= 15) return '#9b30ff'; // range folding
  if (level === 8) return 'rgb(120,120,120)'; // zero line
  const a = Math.abs(level - 8) / 7;
  const main = Math.round(110 + 145 * a);
  const side = Math.round(18 + 26 * a);
  if (level < 8) return `rgb(${side},${main},${side})`;
  return `rgb(${main},${side},${side})`;
}

// ---- Hydrometeor classification (N0H) — categorical. Decoded values are
// class codes; map by bucket to a representative color. ----
function hydroColor(v: number): string | null {
  if (v <= 0) return null;
  if (v < 20) return '#7a7a7a'; // biological / clutter
  if (v < 40) return '#8fd8ff'; // ice crystals
  if (v < 50) return '#bfe9ff'; // dry snow
  if (v < 60) return '#5aa0ff'; // wet snow
  if (v < 80) return '#19b000'; // rain
  if (v < 90) return '#fdf802'; // heavy rain / big drops
  if (v < 100) return '#fd9500'; // graupel
  if (v < 120) return '#fd0000'; // hail
  return '#f800fd'; // unknown / large hail
}

// ---- Correlation coefficient (N0C) — high (~1) = uniform precip, low = mixed
// or non-meteorological (a low-CC "debris ball" inside a storm = tornado debris). ----
function ccColor(v: number): string | null {
  if (v < 0.2) return null;
  if (v >= 0.97) return '#3b6fd4'; // blue — uniform rain/snow
  if (v >= 0.90) return '#3fa9c6'; // teal
  if (v >= 0.80) return '#3fb53f'; // green
  if (v >= 0.70) return '#d6d630'; // yellow
  if (v >= 0.55) return '#e08a2e'; // orange
  return '#d83838'; // red — debris / non-weather
}

// ---- Differential reflectivity (N0X / ZDR, dB) — ~0 spherical (hail/drizzle),
// positive = oblate (rain, big drops), negative = ice/odd. ----
function zdrColor(v: number): string | null {
  if (v <= -2) return '#5a4fd0'; // purple — strongly negative
  if (v < 0.3) return '#7a8a9a'; // grey — near zero (spherical)
  if (v < 1) return '#3fb53f'; // green
  if (v < 2) return '#9fd630'; // light green
  if (v < 3) return '#e0d62e'; // yellow
  if (v < 4.5) return '#e08a2e'; // orange — big drops
  return '#d83838'; // red — very large drops / melting hail
}

// ---- Specific differential phase (N0K / KDP, deg/km) — scales with liquid
// water; high = heavy rain. ----
function kdpColor(v: number): string | null {
  if (v < 0.2) return null; // little/no liquid
  if (v < 0.5) return '#3b6fd4'; // blue
  if (v < 1) return '#3fb53f'; // green
  if (v < 2) return '#e0d62e'; // yellow
  if (v < 3.5) return '#e08a2e'; // orange
  return '#d83838'; // red — heavy rain
}

export const L3_PRODUCTS: Record<string, L3ProductDef> = {
  velocity: {
    key: 'velocity', label: 'Velocity', short: 'V', prod: 'N0G', kind: 'value',
    units: 'kt', legend: 'A tight green/red pair is rotation',
    scale: { range: [-64, 64], labels: ['← toward', '0', 'away →'] },
    display: (v) => v * 1.94384, color: velColor,
  },
  srv: {
    key: 'srv', label: 'Storm-Rel Velocity', short: 'SRV', prod: 'N0S', kind: 'level',
    units: '', legend: 'Motion relative to the storm · purple = range folding',
    scale: { range: [1, 14], labels: ['← inbound', '0', 'outbound →'] }, color: srvColor,
  },
  hydro: {
    key: 'hydro', label: 'Hydrometeor', short: 'HC', prod: 'N0H', kind: 'value',
    units: '', legend: 'Precipitation type, classified by the radar',
    categories: [
      { color: '#8fd8ff', label: 'Snow' },
      { color: '#5aa0ff', label: 'Wet snow' },
      { color: '#19b000', label: 'Rain' },
      { color: '#fdf802', label: 'Heavy rain' },
      { color: '#fd9500', label: 'Graupel' },
      { color: '#fd0000', label: 'Hail' },
      { color: '#7a7a7a', label: 'Clutter' },
    ],
    color: hydroColor,
  },
  reflSite: {
    key: 'reflSite', label: 'Reflectivity (site)', short: 'BR', prod: 'N0B', kind: 'value',
    units: 'dBZ', legend: 'Single-site super-res reflectivity',
    scale: { range: [5, 75], labels: ['5', '40', '75 dBZ'] }, color: reflColor,
  },
  cc: {
    key: 'cc', label: 'Corr. Coeff', short: 'CC', prod: 'N0C', kind: 'value',
    units: '', legend: 'Low CC inside a storm = debris / non-weather',
    scale: { range: [0.2, 1.05], labels: ['0.2', '0.6', '1.0'] }, color: ccColor,
  },
  zdr: {
    key: 'zdr', label: 'Diff. Refl', short: 'ZDR', prod: 'N0X', kind: 'value',
    units: 'dB', legend: 'Bigger / flatter drops read higher',
    scale: { range: [-4, 6], labels: ['−4', '0', '+6 dB'] }, color: zdrColor,
  },
  kdp: {
    key: 'kdp', label: 'KDP', short: 'KDP', prod: 'N0K', kind: 'value',
    units: '°/km', legend: 'Scales with rainfall rate',
    scale: { range: [0, 4], labels: ['0', '2', '4 °/km'] }, color: kdpColor,
  },
};
