// Palettes (applied as CSS variables) + SPC risk + severity colors.

export type Scheme = 'dark' | 'light';

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
}

export const palettes: Record<Scheme, Palette> = {
  dark: {
    background: '#0B1020',
    surface: '#151B2E',
    surfaceAlt: '#1E2742',
    border: '#2A3350',
    text: '#EAF0FF',
    textMuted: '#9AA7C7',
    primary: '#7C8CFF',
    accent: '#22D3EE',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
  },
  light: {
    background: '#F4F7FC',
    surface: '#FFFFFF',
    surfaceAlt: '#EAF0FB',
    border: '#D8E0F0',
    text: '#0F1733',
    textMuted: '#5A6488',
    primary: '#5B4FE0',
    accent: '#0E9FB8',
    success: '#10B981',
    warning: '#D97706',
    danger: '#DC2626',
  },
};

export interface RiskMeta {
  key: string;
  level: number;
  label: string;
  full: string;
  color: string;
  textOn: string;
}

const RISK: Record<string, RiskMeta> = {
  TSTM: { key: 'TSTM', level: 0, label: 'TSTM', full: 'General Thunderstorms', color: '#BFE9C0', textOn: '#0B2014' },
  MRGL: { key: 'MRGL', level: 1, label: 'MRGL', full: 'Marginal (1/5)', color: '#5BA35B', textOn: '#06210C' },
  SLGT: { key: 'SLGT', level: 2, label: 'SLGT', full: 'Slight (2/5)', color: '#F4D03F', textOn: '#2B2200' },
  ENH: { key: 'ENH', level: 3, label: 'ENH', full: 'Enhanced (3/5)', color: '#F39C3C', textOn: '#2B1800' },
  MDT: { key: 'MDT', level: 4, label: 'MDT', full: 'Moderate (4/5)', color: '#E55B5B', textOn: '#2B0606' },
  HIGH: { key: 'HIGH', level: 5, label: 'HIGH', full: 'High (5/5)', color: '#F25CF2', textOn: '#2B062B' },
};

export function getRiskMeta(label?: string | null): RiskMeta | null {
  if (!label) return null;
  return RISK[label.toUpperCase().trim()] ?? null;
}

export function severityColor(severity?: string, event?: string): string {
  const e = (event ?? '').toLowerCase();
  if (e.includes('tornado')) return '#F87171';
  if (e.includes('flash flood') || e.includes('severe thunderstorm')) return '#FB923C';
  const s = (severity ?? '').toLowerCase();
  if (s === 'extreme') return '#F87171';
  if (s === 'severe') return '#FB923C';
  if (s === 'moderate') return '#FBBF24';
  return '#22D3EE';
}
