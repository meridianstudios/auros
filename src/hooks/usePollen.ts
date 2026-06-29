import { useEffect, useState } from 'react';
import { getPollen, type Pollen } from '../api/pollen';

// Daily pollen for the active location. Null until loaded / unavailable (US only).
export function usePollen(lat: number, lon: number): Pollen | null {
  const [data, setData] = useState<Pollen | null>(null);
  useEffect(() => {
    let active = true;
    setData(null);
    getPollen(lat, lon)
      .then((p) => { if (active) setData(p); })
      .catch(() => { if (active) setData(null); });
    return () => { active = false; };
  }, [lat, lon]);
  return data;
}
