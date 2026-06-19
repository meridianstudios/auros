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

export function severityColor(severity?: string, event?: string): string {
  const e = (event ?? '').toLowerCase();
  if (e.includes('tornado')) return '#FB7185';
  if (e.includes('flash flood') || e.includes('severe thunderstorm')) return '#F59E0B';
  const s = (severity ?? '').toLowerCase();
  if (s === 'extreme') return '#FB7185';
  if (s === 'severe') return '#F59E0B';
  if (s === 'moderate') return '#E0B93C';
  return '#6E8BFF';
}
