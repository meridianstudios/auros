import { useEffect, useState } from 'react';
import { getTropical, type Tropical } from '../api/tropical';

// Active tropical systems (global — not location-specific). Fetched once on
// mount; null until loaded or on failure (additive, never blocks the UI).
export function useTropical(): Tropical | null {
  const [data, setData] = useState<Tropical | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => getTropical().then((t) => { if (active) setData(t); }).catch(() => { /* keep last good data */ });
    load();
    const timer = setInterval(load, 300_000); // refresh every 5 min
    return () => { active = false; clearInterval(timer); };
  }, []);
  return data;
}
