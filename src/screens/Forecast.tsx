import { useEffect, useState } from 'react';
import { useLocations } from '../context/LocationsContext';
import { usePrefs, convertTemp } from '../lib/prefs';
import { useWeather } from '../hooks/useWeather';
import { getForecast, type NwsPeriod } from '../api/nws';
import { CondIcon } from '../components/CondIcon';

export function Forecast() {
  const { selected } = useLocations();
  const { prefs } = usePrefs();
  const w = useWeather(selected.lat, selected.lon);
  const [daily, setDaily] = useState<NwsPeriod[]>([]);
  const u = prefs.units;

  useEffect(() => {
    let active = true;
    if (w.point?.forecastUrl) {
      getForecast(w.point.forecastUrl).then((p) => active && setDaily(p)).catch(() => {});
    }
    return () => { active = false; };
  }, [w.point]);

  return (
    <div className="view fade">
      <div className="topbar">
        <h1>Forecast</h1>
        <p>{w.point?.city ? `${w.point.city}, ${w.point.state}` : selected.name}</p>
      </div>
      <div className="pad">
        <div className="label">Next days</div>
        {daily.length === 0 ? (
          <div className="center" style={{ minHeight: 100 }}><div className="spin" /></div>
        ) : (
          <div className="group">
            {daily.slice(0, 12).map((p) => (
              <div className="item" key={p.number}>
                <span className="ic"><CondIcon p={p} size={20} /></span>
                <div className="grow">
                  <div className="t">{p.name}</div>
                  <div className="s">{p.shortForecast}</div>
                </div>
                <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{convertTemp(p.temperature, u)}°</div>
              </div>
            ))}
          </div>
        )}

        <div className="label">Hourly · next 24</div>
        <div className="group">
          {w.hourly.slice(0, 24).map((h) => {
            const pop = h.probabilityOfPrecipitation?.value ?? 0;
            return (
              <div className="item" key={h.startTime}>
                <span className="ic"><CondIcon p={h} size={19} /></span>
                <div className="grow">
                  <div className="t">{new Date(h.startTime).toLocaleTimeString([], { hour: 'numeric' })}</div>
                  <div className="s">{h.shortForecast}{h.windSpeed ? ` · ${h.windDirection} ${h.windSpeed}` : ''}</div>
                </div>
                {pop >= 10 && <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13, minWidth: 38, textAlign: 'right' }}>{pop}%</div>}
                <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 38, textAlign: 'right' }}>{convertTemp(h.temperature, u)}°</div>
              </div>
            );
          })}
        </div>
        <div className="dim" style={{ textAlign: 'center', fontSize: 11, marginTop: 12 }}>
          National Weather Service · api.weather.gov
        </div>
      </div>
    </div>
  );
}
