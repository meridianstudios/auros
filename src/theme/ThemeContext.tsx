import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { palettes, type Palette, type Scheme } from './colors';

interface ThemeValue {
  scheme: Scheme;
  colors: Palette;
  toggle: () => void;
  setScheme: (s: Scheme) => void;
}

const KEY = 'nw.theme';
const ThemeContext = createContext<ThemeValue | undefined>(undefined);

function applyVars(p: Palette) {
  const r = document.documentElement;
  r.style.setProperty('--bg', p.background);
  r.style.setProperty('--surface', p.surface);
  r.style.setProperty('--surface-alt', p.surfaceAlt);
  r.style.setProperty('--border', p.border);
  r.style.setProperty('--text', p.text);
  r.style.setProperty('--text-muted', p.textMuted);
  r.style.setProperty('--text-dim', p.textDim);
  r.style.setProperty('--shadow', p.shadow);
  r.style.setProperty('--primary', p.primary);
  r.style.setProperty('--accent', p.accent);
  r.style.setProperty('--success', p.success);
  r.style.setProperty('--warning', p.warning);
  r.style.setProperty('--danger', p.danger);
  r.style.setProperty('--glass', p.glass);
}

const ORDER: Scheme[] = ['midnight', 'storm', 'dark'];

function initialScheme(): Scheme {
  const saved = localStorage.getItem(KEY);
  if (saved && saved in palettes) return saved as Scheme;
  // Older builds stored 'light' (retired) — fall back to the default.
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<Scheme>(initialScheme);

  useEffect(() => {
    applyVars(palettes[scheme]);
    document.documentElement.setAttribute('data-theme', scheme);
  }, [scheme]);

  const setScheme = (s: Scheme) => {
    setSchemeState(s);
    localStorage.setItem(KEY, s);
  };

  const value = useMemo<ThemeValue>(
    () => ({
      scheme,
      colors: palettes[scheme],
      toggle: () => setScheme(ORDER[(ORDER.indexOf(scheme) + 1) % ORDER.length]),
      setScheme,
    }),
    [scheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
