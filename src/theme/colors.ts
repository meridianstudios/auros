// Refined, minimal palette (applied as CSS variables) + SPC risk + severity colors.

export type Scheme = 'dark' | 'light';

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textDim: string;
  primary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  shadow: string;
}

export const palettes: Record<Scheme, Palette> = {
  dark: {
    background: '#0A0C12',
    surface: '#13161F',
    surfaceAlt: '#1C1F2B',
    border: 'rgba(255,255,255,0.07)',
    text: '#F4F6FB',
    textMuted: '#8B91A3',
    textDim: '#5A6072',
    primary: '#5B8DEF',
    accent: '#5B8DEF',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#FB7185',
    shadow: 'rgba(0,0,0,0.5)',
  },
  light: {
    background: '#FBFBFD',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F3F8',
    border: 'rgba(0,0,0,0.08)',
    text: '#0B0D14',
    textMuted: '#6B7180',
    textDim: '#9AA0AE',
    primary: '#3B6FE5',
    accent: '#3B6FE5',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#E11D48',
    shadow: 'rgba(20,30,60,0.10)',
  },
};

export interface RiskMeta {
  key: string;
  level: number;
  label: string;
  full: string;
  color: string;
}

const RISK: Record<string, RiskMeta> = {
  TSTM: { key: 'TSTM', level: 0, label: 'TSTM', full: 'General Thunderstorms', color: '#7FB98B' },
  MRGL: { key: 'MRGL', level: 1, label: 'MRGL', full: 'Marginal', color: '#4E9E5E' },
  SLGT: { key: 'SLGT', level: 2, label: 'SLGT', full: 'Slight', color: '#E0B93C' },
  ENH: { key: 'ENH', level: 3, label: 'ENH', full: 'Enhanced', color: '#E2872F' },
  MDT: { key: 'MDT', level: 4, label: 'MDT', full: 'Moderate', color: '#DE5450' },
  HIGH: { key: 'HIGH', level: 5, label: 'HIGH', full: 'High', color: '#E25CD9' },
};

export function getRiskMeta(label?: string | null): RiskMeta | null {
  if (!label) return null;
  return RISK[label.toUpperCase().trim()] ?? null;
}

// Official NWS hazard colors (the same palette used on weather.gov), keyed by
// exact event name so a polygon's color tells you the warning type at a glance.
const NWS_COLORS: Record<string, string> = {
  'tornado warning': '#FF0000',
  'extreme wind warning': '#FF8C00',
  'severe thunderstorm warning': '#FFA500',
  'flash flood warning': '#8B0000',
  'flash flood statement': '#8B0000',
  'severe weather statement': '#00FFFF',
  'snow squall warning': '#C71585',
  'flood warning': '#00FF00',
  'flood statement': '#00FF00',
  'flood advisory': '#00FF7F',
  'hydrologic advisory': '#00FF7F',
  'special marine warning': '#FFA500',
  'special weather statement': '#FFE4B5',
  'tornado watch': '#FFFF00',
  'severe thunderstorm watch': '#DB7093',
  'flash flood watch': '#2E8B57',
  'flood watch': '#2E8B57',
  'hurricane warning': '#DC143C',
  'hurricane watch': '#FF00FF',
  'tropical storm warning': '#B22222',
  'tropical storm watch': '#F08080',
  'storm surge warning': '#B524F7',
  'storm surge watch': '#DB7FF7',
  'winter storm warning': '#FF69B4',
  'winter storm watch': '#4682B4',
  'winter weather advisory': '#7B68EE',
  'ice storm warning': '#8B008B',
  'blizzard warning': '#FF4500',
  'wind chill warning': '#B0C4DE',
  'wind chill advisory': '#AFEEEE',
  'high wind warning': '#DAA520',
  'high wind watch': '#B8860B',
  'wind advisory': '#D2B48C',
  'excessive heat warning': '#C71585',
  'excessive heat watch': '#800000',
  'heat advisory': '#FF7F50',
  'freeze warning': '#483D8B',
  'freeze watch': '#00FFFF',
  'frost advisory': '#6495ED',
  'dense fog advisory': '#708090',
  'red flag warning': '#FF1493',
  'fire weather watch': '#FFDEAD',
  'air quality alert': '#808080',
  'air stagnation advisory': '#808080',
  'coastal flood warning': '#228B22',
  'coastal flood watch': '#66CDAA',
  'coastal flood advisory': '#7CFC00',
  'small craft advisory': '#D8BFD8',
  'gale warning': '#DDA0DD',
  'tsunami warning': '#FD6347',
  'dust storm warning': '#FFE4C4',
};

export function severityColor(severity?: string, event?: string): string {
  const e = (event ?? '').toLowerCase().trim();
  if (NWS_COLORS[e]) return NWS_COLORS[e];

  // Fallbacks for naming variants not in the exact table.
  const watch = e.includes('watch');
  if (e.includes('tornado')) return watch ? '#FFFF00' : '#FF0000';
  if (e.includes('severe thunderstorm')) return watch ? '#DB7093' : '#FFA500';
  if (e.includes('flash flood')) return watch ? '#2E8B57' : '#8B0000';
  if (e.includes('hurricane')) return watch ? '#FF00FF' : '#DC143C';
  if (e.includes('tropical storm')) return watch ? '#F08080' : '#B22222';
  if (e.includes('storm surge')) return watch ? '#DB7FF7' : '#B524F7';
  if (e.includes('flood')) return watch ? '#2E8B57' : e.includes('advisory') ? '#00FF7F' : '#00FF00';
  if (e.includes('winter') || e.includes('snow') || e.includes('ice')) return watch ? '#4682B4' : '#FF69B4';
  if (e.includes('heat')) return e.includes('warning') ? '#C71585' : watch ? '#800000' : '#FF7F50';
  if (e.includes('wind')) return '#DAA520';
  if (e.includes('fire') || e.includes('red flag')) return watch ? '#FFDEAD' : '#FF1493';

  // Last resort: severity bucket.
  const s = (severity ?? '').toLowerCase();
  if (s === 'extreme') return '#FF0000';
  if (s === 'severe') return '#FFA500';
  if (s === 'moderate') return '#E0B93C';
  return '#6E8BFF';
}
