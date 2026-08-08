import { useEffect, useState } from 'react';
import { getLsrs, type Lsr } from '../api/lsr';

// Recent storm reports near a location. Refreshes on location change and every
// few minutes so a live event fills in.
export function useLsr(lat: number, lon: number) {
  const [lsrs, setLsrs] = useState<Lsr[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getLsrs(lat, lon)
        .then((r) => { if (!cancelled) { setLsrs(r); setLoading(false); } })
        .catch(() => { if (!cancelled) { setLsrs([]); setLoading(false); } });
    };
    setLoading(true);
    load();
    const t = setInterval(load, 180_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [lat, lon]);

  return { lsrs, loading };
}
