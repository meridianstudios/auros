// Extra current conditions + air quality from Open-Meteo (free, no key, CORS).
// NWS doesn't cleanly expose feels-like / UV / AQI, so we layer these on top of
// the NWS forecast. Temps come back in °F to match the app's F-based convertTemp.

export interface Conditions {
  feelsLikeF: number | null;
  humidity: number | null; // %
  dewpointF: number | null;
  gustMph: number | null;
  pressureHpa: number | null;
  visibilityM: number | null;
  uv: number | null;
  isDay: boolean;
  sunrise: string | null; // local ISO ("2026-06-20T06:29")
  sunset: string | null;
  aqi: number | null; // US AQI
  pm25: number | null;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export async function getConditions(lat: number, lon: number): Promise<Conditions> {
  const fc =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=apparent_temperature,relative_humidity_2m,dew_point_2m,surface_pressure,wind_gusts_10m,visibility,uv_index,is_day` +
    `&daily=sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=1`;
  const aqu =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5&timezone=auto`;

  const [w, a] = await Promise.allSettled([
    fetch(fc).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    fetch(aqu).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
  ]);
  const cur = w.status === 'fulfilled' ? w.value.current ?? {} : {};
  const day = w.status === 'fulfilled' ? w.value.daily ?? {} : {};
  const air = a.status === 'fulfilled' ? a.value.current ?? {} : {};

  return {
    feelsLikeF: num(cur.apparent_temperature),
    humidity: num(cur.relative_humidity_2m),
    dewpointF: num(cur.dew_point_2m),
    gustMph: num(cur.wind_gusts_10m),
    pressureHpa: num(cur.surface_pressure),
    visibilityM: num(cur.visibility),
    uv: num(cur.uv_index),
    isDay: cur.is_day === 1,
    sunrise: day.sunrise?.[0] ?? null,
    sunset: day.sunset?.[0] ?? null,
    aqi: num(air.us_aqi),
    pm25: num(air.pm2_5),
  };
}

// US EPA AQI category + color.
export function aqiInfo(aqi: number): { label: string; color: string } {
  if (aqi <= 50) return { label: 'Good', color: '#4ADE80' };
  if (aqi <= 100) return { label: 'Moderate', color: '#FBBF24' };
  if (aqi <= 150) return { label: 'Unhealthy (sensitive)', color: '#FB923C' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#FB7185' };
  if (aqi <= 300) return { label: 'Very unhealthy', color: '#C084FC' };
  return { label: 'Hazardous', color: '#E11D48' };
}

// UV index category.
export function uvInfo(uv: number): string {
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Moderate';
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very high';
  return 'Extreme';
}
