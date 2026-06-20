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
  /** convert a stored value to the number shown to the user (e.g. m/s -> kt) */
  display?: (v: number) => number;
  color: (v: number) => string | null;
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

// ---- Velocity (N0G) — diverging: inbound (toward radar, negative) green,
// outbound (positive) red, near-zero dark ----
function velColor(ms: number): string | null {
  if (Math.abs(ms) < 1) return null; // suppress near-zero clutter
  const a = Math.min(Math.abs(ms) / 50, 1);
  if (ms <= 0) {
    return `rgb(${Math.round(15 * (1 - a))},${Math.round(70 + 185 * a)},${Math.round(45 * (1 - a))})`;
  }
  return `rgb(${Math.round(70 + 185 * a)},${Math.round(28 * (1 - a))},${Math.round(28 * (1 - a))})`;
}

// ---- Storm-relative velocity (N0S) — 16 run-length levels, diverging ----
function srvColor(level: number): string | null {
  if (level === 0) return null;
  if (level >= 15) return '#9b30ff'; // range folding
  const a = Math.abs(level - 8) / 7;
  if (level < 8) return `rgb(${Math.round(15 * (1 - a))},${Math.round(80 + 175 * a)},45)`;
  return `rgb(${Math.round(80 + 175 * a)},30,30)`;
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

export const L3_PRODUCTS: Record<string, L3ProductDef> = {
  velocity: {
    key: 'velocity', label: 'Velocity', short: 'V', prod: 'N0G', kind: 'value',
    units: 'kt', legend: 'Green = toward radar · Red = away — tight green/red pair = rotation',
    display: (v) => v * 1.94384, color: velColor,
  },
  srv: {
    key: 'srv', label: 'Storm-Rel Velocity', short: 'SRV', prod: 'N0S', kind: 'level',
    units: '', legend: 'Storm-relative motion · purple = range folding', color: srvColor,
  },
  hydro: {
    key: 'hydro', label: 'Hydrometeor', short: 'HC', prod: 'N0H', kind: 'value',
    units: '', legend: 'Precip type — blue snow · green rain · red/pink hail', color: hydroColor,
  },
  reflSite: {
    key: 'reflSite', label: 'Reflectivity (site)', short: 'BR', prod: 'N0B', kind: 'value',
    units: 'dBZ', legend: 'Single-site super-res · light → heavy (dBZ)', color: reflColor,
  },
};
