import { useEffect, useState } from 'react';
import { getConditions, type Conditions } from '../api/conditions';

// Supplementary current conditions (feels-like, humidity, UV, AQI, sun times).
// Returns null until loaded or on failure — it's additive, never blocks the UI.
export function useConditions(lat: number, lon: number): Conditions | null {
  const [data, setData] = useState<Conditions | null>(null);
  useEffect(() => {
    let active = true;
    setData(null);
    getConditions(lat, lon)
      .then((c) => { if (active) setData(c); })
      .catch(() => { if (active) setData(null); });
    return () => { active = false; };
  }, [lat, lon]);
  return data;
}
