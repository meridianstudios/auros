// Photographic sky picked by condition + day/night (public/sky/*.jpg). Two modes:
//   - variant="hero": fills just the hero (legacy).
//   - variant="page": a full-page pinned backdrop for the immersive home — the
//     sky stays fixed to the viewport while content scrolls over it, with live
//     rain/snow/lightning layered on and a downward tint so glass cards stay
//     readable.

type SkyKind = 'clear' | 'clouds' | 'overcast' | 'rain' | 'storm' | 'snow' | 'fog';

// NWS shortForecast → a sky bucket. Order matters: the wet/violent conditions win
// over the cloud words, and "partly/mostly sunny" beats the generic "cloudy".
function classifyKind(text = ''): SkyKind {
  const t = text.toLowerCase();
  // A slight chance / chance of storms or rain is a fair day — partly cloudy sky,
  // not a dark storm/rain photo. Only definite/likely precip gets the moody sky.
  const slight = /slight chance|chance/.test(t);
  if (/thunder|t-storm|tstm/.test(t)) return slight ? 'clouds' : 'storm';
  if (/snow|flurr|sleet|ice|wintry|blizzard/.test(t)) return 'snow';
  if (/rain|shower|drizzle/.test(t)) return slight ? 'clouds' : 'rain';
  if (/fog|haze|smoke|mist/.test(t)) return 'fog';
  if (/partly|mostly sunny|few clouds|scattered/.test(t)) return 'clouds';
  if (/overcast|cloudy|cloud/.test(t)) return 'overcast';
  return 'clear';
}

// Clear has a real night frame; the grey conditions reuse one image day and night
// and get darkened by CSS at night (see .skp-night).
function imageFor(kind: SkyKind, isDay: boolean): string {
  switch (kind) {
    case 'clear': return isDay ? 'clear-day' : 'clear-night';
    case 'clouds': return isDay ? 'partly-day' : 'overcast';
    case 'overcast': return 'overcast';
    case 'rain': return 'rain';
    case 'storm': return 'storm';
    case 'snow': return 'snow';
    case 'fog': return 'fog';
  }
}

export function SkyPhoto({ condition, isDay, variant = 'hero' }: { condition?: string; isDay: boolean; variant?: 'hero' | 'page' }) {
  const kind = classifyKind(condition);
  const img = imageFor(kind, isDay);
  const graded = !isDay && kind !== 'clear'; // a day/grey image shown at night → darken it
  const precip = (
    <>
      {(kind === 'rain' || kind === 'storm') && <div className="skp-rain" aria-hidden="true" />}
      {kind === 'storm' && <div className="skp-flash" aria-hidden="true" />}
      {kind === 'snow' && <div className="skp-snow" aria-hidden="true" />}
    </>
  );

  if (variant === 'page') {
    return (
      <div className={`home-sky${graded ? ' skp-night' : ''}`} aria-hidden="true">
        <div className="home-sky-layer">
          <div className="home-sky-img" style={{ backgroundImage: `url("/sky/${img}.jpg")` }} />
          {precip}
          <div className="home-sky-tint" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`hero-photo sky-photo${graded ? ' skp-night' : ''}`}
        style={{ backgroundImage: `url("/sky/${img}.jpg")` }}
      />
      {precip}
    </>
  );
}
