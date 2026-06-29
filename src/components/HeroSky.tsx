// Animated sky behind the Home hero. Reflects the live condition and, when sun
// times are known, places a sun (or moon at night) along its real arc for the
// time of day — low near sunrise/sunset, high at midday — the way Google Weather
// and weather.com do. Pure CSS motion (transforms + opacity), kept subtle so the
// hero text stays readable. Respects prefers-reduced-motion (see index.css).

type Sky = 'clear' | 'clouds' | 'rain' | 'storm' | 'snow' | 'fog';

function classify(text = ''): Sky {
  const t = text.toLowerCase();
  if (/thunder|t-storm|tstm/.test(t)) return 'storm';
  if (/snow|flurr|sleet|ice|wintry|blizzard/.test(t)) return 'snow';
  if (/rain|shower|drizzle/.test(t)) return 'rain';
  if (/fog|haze|smoke|mist/.test(t)) return 'fog';
  if (/cloud|overcast/.test(t)) return 'clouds';
  return 'clear';
}

// "2026-06-28T21:00" → minutes since local midnight, or null.
function mins(iso?: string | null): number | null {
  if (!iso) return null;
  const t = iso.split('T')[1];
  if (!t) return null;
  const [h, m] = t.split(':');
  const v = parseInt(h, 10) * 60 + parseInt(m, 10);
  return Number.isFinite(v) ? v : null;
}

interface Props {
  condition?: string;
  day: boolean;
  sunrise?: string | null;
  sunset?: string | null;
  now?: string | null;
}

export function HeroSky({ condition, day, sunrise, sunset, now }: Props) {
  const sky = classify(condition);
  const sr = mins(sunrise);
  const ss = mins(sunset);
  const nw = mins(now);

  // Fraction (0→1) along the current arc: day arc sunrise→sunset, else the night
  // arc sunset→sunrise. Falls back to mid-sky when sun times aren't loaded yet.
  let frac = 0.5;
  let isDayNow = day;
  if (sr != null && ss != null && nw != null && ss > sr) {
    isDayNow = nw >= sr && nw < ss;
    if (isDayNow) {
      frac = (nw - sr) / (ss - sr);
    } else {
      const nightLen = 1440 - (ss - sr);
      const since = nw < sr ? nw + 1440 - ss : nw - ss;
      frac = nightLen > 0 ? since / nightLen : 0.5;
    }
  }
  frac = Math.min(1, Math.max(0, frac));

  const x = 8 + frac * 84; // 8%..92% across the sky
  const height = Math.sin(frac * Math.PI); // 0 at horizon, 1 at the peak
  const bodyStyle = { left: `${x}%`, top: `${62 - height * 46}%` }; // 16% peak … 62% horizon

  // Day phase tints the wash: warm at the edges, bright midday, deep at night.
  let phase: 'dawn' | 'day' | 'dusk' | 'night' = 'night';
  if (isDayNow) phase = frac < 0.14 ? 'dawn' : frac > 0.86 ? 'dusk' : 'day';

  const showBody = sky === 'clear' || sky === 'clouds';

  return (
    <div className={`hero-sky sky-${sky} phase-${phase} ${isDayNow ? 'is-day' : 'is-night'}`} aria-hidden="true">
      {showBody && (
        <div className={`celestial ${isDayNow ? 'sun' : 'moon'}${sky === 'clouds' ? ' dimmed' : ''}`} style={bodyStyle}>
          {isDayNow && <span className="rays" />}
        </div>
      )}

      {sky === 'clear' && !isDayNow && <div className="stars" />}
      {sky === 'clear' && isDayNow && (
        <>
          <span className="bird b1" />
          <span className="bird b2" />
        </>
      )}

      {sky === 'clouds' && (
        <>
          <span className="cloud c1" />
          <span className="cloud c2" />
          <span className="cloud c3" />
        </>
      )}
      {(sky === 'rain' || sky === 'storm') && (
        <>
          <span className="cloud c1 dark" />
          <span className="cloud c2 dark" />
          <div className="rain" />
        </>
      )}
      {sky === 'storm' && <div className="flash" />}
      {sky === 'snow' && (
        <>
          <span className="cloud c1" />
          <span className="cloud c2" />
          <div className="snow" />
        </>
      )}
      {sky === 'fog' && <div className="fog" />}
    </div>
  );
}
