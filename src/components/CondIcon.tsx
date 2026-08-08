import { Sun, Moon, Cloud, CloudSun, CloudMoon, CloudRain, CloudSunRain, CloudMoonRain, CloudDrizzle, CloudSnow, CloudFog, CloudLightning } from 'lucide-react';
import type { NwsPeriod } from '../api/nws';

export function CondIcon({ p, size = 20, color = 'var(--text-muted)' }: { p: NwsPeriod; size?: number; color?: string }) {
  const s = (p.shortForecast || '').toLowerCase();
  const day = p.isDaytime !== false;
  // A "slight chance" / "chance" of rain OR storms is a mostly-fair day — show
  // sun-with-a-sprinkle, not a downpour or a lightning cloud (which read as "it's
  // storming" on a nice day). Only a definite/likely forecast gets the dramatic icon.
  const slight = /slight chance|chance/.test(s);
  const props = { size, color };
  if (slight && /thunder|t-storm|rain|shower|drizzle/.test(s)) return day ? <CloudSunRain {...props} /> : <CloudMoonRain {...props} />;
  if (/thunder|t-storm/.test(s)) return <CloudLightning {...props} />;
  if (/snow|sleet|ice|wintry|flurr/.test(s)) return <CloudSnow {...props} />;
  if (/drizzle/.test(s)) return <CloudDrizzle {...props} />;
  if (/rain|shower/.test(s)) return <CloudRain {...props} />;
  if (/fog|haze|mist/.test(s)) return <CloudFog {...props} />;
  if (/cloud|overcast/.test(s)) {
    if (/partly|mostly sunny|few|mostly clear/.test(s)) return day ? <CloudSun {...props} /> : <CloudMoon {...props} />;
    return <Cloud {...props} />;
  }
  if (/sun|clear/.test(s)) return day ? <Sun {...props} /> : <Moon {...props} />;
  return day ? <CloudSun {...props} /> : <CloudMoon {...props} />;
}
