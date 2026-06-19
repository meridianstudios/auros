import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { geocode } from '../api/geocode';
import { useAuth } from './AuthContext';
import { db } from '../lib/firebase';

export interface SavedLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

interface LocationsValue {
  locations: SavedLocation[];
  selected: SavedLocation;
  selectedId: string;
  select: (id: string) => void;
  addByCurrentPosition: () => Promise<void>;
  addByName: (query: string) => Promise<void>;
  remove: (id: string) => void;
}

const KEY = 'nw.locations';
const SEL = 'nw.selected';

const DEFAULT: SavedLocation = { id: 'noble-twp', name: 'Noble Twp, MI', lat: 41.85, lon: -85.18 };

const LocationsContext = createContext<LocationsValue | undefined>(undefined);

let counter = 0;
const newId = () => `loc-${Date.now()}-${counter++}`;

function load(): SavedLocation[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch { /* ignore */ }
  return [DEFAULT];
}

export function LocationsProvider({ children }: { children: ReactNode }) {
  const [locations, setLocations] = useState<SavedLocation[]>(load);
  const [selectedId, setSelectedId] = useState<string>(() => localStorage.getItem(SEL) || DEFAULT.id);

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(locations)); }, [locations]);
  useEffect(() => { localStorage.setItem(SEL, selectedId); }, [selectedId]);

  // ---- Cloud sync (only active when signed in + Firebase configured) ----
  const { user } = useAuth();
  const synced = useRef(false);

  // On sign-in: pull cloud copy if it exists, otherwise seed cloud from local.
  useEffect(() => {
    if (!user || !db) { synced.current = false; return; }
    let active = true;
    (async () => {
      try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (!active) return;
        const data = snap.data() as { locations?: SavedLocation[]; selectedId?: string } | undefined;
        if (data?.locations?.length) {
          setLocations(data.locations);
          if (data.selectedId) setSelectedId(data.selectedId);
        } else {
          await setDoc(ref, { locations, selectedId }, { merge: true });
        }
        synced.current = true;
      } catch { /* offline / rules — stay local */ }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // After cloud load, push every change up.
  useEffect(() => {
    if (!user || !db || !synced.current) return;
    setDoc(doc(db, 'users', user.uid), { locations, selectedId }, { merge: true }).catch(() => {});
  }, [locations, selectedId, user]);

  const add = (name: string, lat: number, lon: number) => {
    const loc: SavedLocation = { id: newId(), name, lat, lon };
    setLocations((cur) => [...cur, loc]);
    setSelectedId(loc.id);
  };

  const addByCurrentPosition = () =>
    new Promise<void>((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
      navigator.geolocation.getCurrentPosition(
        (pos) => { add('My Location', pos.coords.latitude, pos.coords.longitude); resolve(); },
        (err) => reject(new Error(err.message || 'Location denied')),
        { enableHighAccuracy: false, timeout: 10000 }
      );
    });

  const addByName = async (query: string) => {
    const r = await geocode(query);
    add(r.name, r.lat, r.lon);
  };

  const remove = (id: string) => {
    setLocations((cur) => {
      if (cur.length <= 1) return cur;
      const next = cur.filter((l) => l.id !== id);
      if (selectedId === id) setSelectedId(next[0].id);
      return next;
    });
  };

  const selected = useMemo(
    () => locations.find((l) => l.id === selectedId) ?? locations[0],
    [locations, selectedId]
  );

  const value = useMemo<LocationsValue>(
    () => ({ locations, selected, selectedId: selected?.id ?? '', select: setSelectedId, addByCurrentPosition, addByName, remove }),
    [locations, selected]
  );

  return <LocationsContext.Provider value={value}>{children}</LocationsContext.Provider>;
}

export function useLocations(): LocationsValue {
  const ctx = useContext(LocationsContext);
  if (!ctx) throw new Error('useLocations must be used within LocationsProvider');
  return ctx;
}
