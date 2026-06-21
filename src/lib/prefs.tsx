import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db } from './firebase';

export type Units = 'F' | 'C';
export interface NotifyPrefs {
  tornado: boolean;
  severe: boolean; // severe t-storm + flash flood warnings
  watches: boolean;
  advisories: boolean;
  stormHeadsUp: boolean; // the storm-approach timeline heads-up
  alarmSound: boolean; // play the EAS tone with the on-screen alert box
}
export interface QuietHours { enabled: boolean; start: number; end: number } // hours 0-23
export interface Prefs { units: Units; notify: NotifyPrefs; quiet: QuietHours }

const DEFAULT: Prefs = {
  units: 'F',
  notify: { tornado: true, severe: true, watches: true, advisories: false, stormHeadsUp: true, alarmSound: true },
  quiet: { enabled: false, start: 22, end: 7 },
};

const KEY = 'nw.prefs';

interface PrefsValue {
  prefs: Prefs;
  setUnits: (u: Units) => void;
  setNotify: (k: keyof NotifyPrefs, v: boolean) => void;
  setQuiet: (q: Partial<QuietHours>) => void;
}

const PrefsContext = createContext<PrefsValue | undefined>(undefined);

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { ...DEFAULT, ...p, notify: { ...DEFAULT.notify, ...p.notify }, quiet: { ...DEFAULT.quiet, ...p.quiet } };
    }
  } catch { /* ignore */ }
  return DEFAULT;
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(load);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(prefs)); }, [prefs]);

  // ---- Cloud sync (only active when signed in + Firebase configured) ----
  const { user } = useAuth();
  const synced = useRef(false);

  useEffect(() => {
    if (!user || !db) { synced.current = false; return; }
    let active = true;
    (async () => {
      try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (!active) return;
        const data = snap.data() as { prefs?: Partial<Prefs> } | undefined;
        if (data?.prefs) {
          const p = data.prefs;
          setPrefs({ ...DEFAULT, ...p, notify: { ...DEFAULT.notify, ...p.notify }, quiet: { ...DEFAULT.quiet, ...p.quiet } });
        } else {
          await setDoc(ref, { prefs }, { merge: true });
        }
        synced.current = true;
      } catch { /* offline / rules — stay local */ }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user || !db || !synced.current) return;
    setDoc(doc(db, 'users', user.uid), { prefs }, { merge: true }).catch(() => {});
  }, [prefs, user]);

  const value = useMemo<PrefsValue>(() => ({
    prefs,
    setUnits: (units) => setPrefs((p) => ({ ...p, units })),
    setNotify: (k, v) => setPrefs((p) => ({ ...p, notify: { ...p.notify, [k]: v } })),
    setQuiet: (q) => setPrefs((p) => ({ ...p, quiet: { ...p.quiet, ...q } })),
  }), [prefs]);

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs must be used within PrefsProvider');
  return ctx;
}

// ---- helpers ----

export function convertTemp(tempF: number, units: Units): number {
  return units === 'C' ? Math.round((tempF - 32) * 5 / 9) : Math.round(tempF);
}

export function isQuietNow(q: QuietHours, now = new Date()): boolean {
  if (!q.enabled) return false;
  const h = now.getHours();
  return q.start <= q.end ? h >= q.start && h < q.end : h >= q.start || h < q.end;
}

function alertCategory(event: string): 'tornado' | 'severe' | 'watch' | 'advisory' | 'other' {
  const e = event.toLowerCase();
  if (e.includes('tornado warning')) return 'tornado';
  if (e.includes('severe thunderstorm warning') || e.includes('flash flood warning')) return 'severe';
  if (e.includes('watch')) return 'watch';
  if (e.includes('advisory') || e.includes('statement')) return 'advisory';
  return 'other';
}

// Should we fire a notification for this alert, given prefs + quiet hours?
export function shouldNotifyAlert(event: string, p: Prefs): boolean {
  const cat = alertCategory(event);
  const allowed =
    cat === 'tornado' ? p.notify.tornado :
    cat === 'severe' ? p.notify.severe :
    cat === 'watch' ? p.notify.watches :
    cat === 'advisory' ? p.notify.advisories :
    true;
  if (!allowed) return false;
  if (cat !== 'tornado' && isQuietNow(p.quiet)) return false; // tornado always overrides quiet hours
  return true;
}
