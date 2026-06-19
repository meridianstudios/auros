import { useCallback, useEffect, useState } from 'react';
import { getActiveAlerts, getForecast, getPoint, type NwsAlert, type NwsPeriod, type NwsPoint } from '../api/nws';
import { getDayRisk } from '../api/spc';
import { analyzeStormTimeline, type StormWindow } from '../api/timeline';
import type { RiskMeta } from '../theme/colors';

export interface UseWeather {
  point: NwsPoint | null;
  current: NwsPeriod | null;
  hourly: NwsPeriod[];
  daily: NwsPeriod[];
  timeline: StormWindow | null;
  risk: RiskMeta | null;
  riskTomorrow: RiskMeta | null;
  riskError: boolean;
  alerts: NwsAlert[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWeather(lat: number, lon: number): UseWeather {
  const [point, setPoint] = useState<NwsPoint | null>(null);
  const [current, setCurrent] = useState<NwsPeriod | null>(null);
  const [hourly, setHourly] = useState<NwsPeriod[]>([]);
  const [daily, setDaily] = useState<NwsPeriod[]>([]);
  const [timeline, setTimeline] = useState<StormWindow | null>(null);
  const [risk, setRisk] = useState<RiskMeta | null>(null);
  const [riskTomorrow, setRiskTomorrow] = useState<RiskMeta | null>(null);
  const [riskError, setRiskError] = useState(false);
  const [alerts, setAlerts] = useState<NwsAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [pt, al, r1, r2] = await Promise.allSettled([
      getPoint(lat, lon),
      getActiveAlerts(lat, lon),
      getDayRisk(lat, lon, 1),
      getDayRisk(lat, lon, 2),
    ]);

    const p = pt.status === 'fulfilled' ? pt.value : null;
    setPoint(p);
    setAlerts(al.status === 'fulfilled' ? al.value : []);
    setRisk(r1.status === 'fulfilled' ? r1.value.risk : null);
    setRiskTomorrow(r2.status === 'fulfilled' ? r2.value.risk : null);
    setRiskError(r1.status === 'rejected');

    if (p?.forecastHourlyUrl) {
      try {
        const periods = await getForecast(p.forecastHourlyUrl);
        setCurrent(periods[0] ?? null);
        setHourly(periods.slice(0, 24));
        setTimeline(analyzeStormTimeline(periods));
      } catch {
        setCurrent(null);
        setHourly([]);
        setTimeline(null);
      }
    }

    if (p?.forecastUrl) {
      try { setDaily(await getForecast(p.forecastUrl)); } catch { setDaily([]); }
    }

    if (!p && al.status === 'rejected') {
      setError('Could not reach weather services. Check your connection.');
    }
    setLoading(false);
  }, [lat, lon]);

  useEffect(() => { refresh(); }, [refresh]);

  return { point, current, hourly, daily, timeline, risk, riskTomorrow, riskError, alerts, loading, error, refresh };
}
