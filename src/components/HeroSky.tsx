// Subtle animated sky behind the Home hero — reflects the current condition and
// day/night. Pure CSS (gradients + transforms), low-opacity so the hero text
// stays readable in both themes. Respects prefers-reduced-motion (see index.css).

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

export function HeroSky({ condition, day }: { condition?: string; day: boolean }) {
  const sky = classify(condition);
  return (
    <div className={`hero-sky sky-${sky} ${day ? 'is-day' : 'is-night'}`} aria-hidden="true">
      {sky === 'clear' && !day && <div className="stars" />}
      {sky === 'clouds' && (
        <>
          <span className="cloud c1" />
          <span className="cloud c2" />
          <span className="cloud c3" />
        </>
      )}
      {(sky === 'rain' || sky === 'storm') && (
        <>
          <span className="cloud c1" />
          <span className="cloud c2" />
          <div className="rain" />
        </>
      )}
      {sky === 'storm' && <div className="flash" />}
      {sky === 'snow' && (
        <>
          <span className="cloud c1" />
          <div className="snow" />
        </>
      )}
      {sky === 'fog' && <div className="fog" />}
    </div>
  );
}
