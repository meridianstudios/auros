import { useEffect, useState } from 'react';
import { getTropical, type Tropical } from '../api/tropical';

// Active tropical systems (global — not location-specific). Fetched once on
// mount; null until loaded or on failure (additive, never blocks the UI).
export function useTropical(): Tropical | null {
  const [data, setData] = useState<Tropical | null>(null);
  useEffect(() => {
    let active = true;
    getTropical()
      .then((t) => { if (active) setData(t); })
      .catch(() => { if (active) setData(null); });
    return () => { active = false; };
  }, []);
  return data;
}
