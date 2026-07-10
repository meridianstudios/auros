import { useId, type ReactNode } from 'react';
import type { NwsPeriod } from '../api/nws';

// Recreations of the classic 2000s The Weather Channel / Weatherscan forecast
// icons: a gold ray sun, a bold gold crescent moon (masked, so it always renders
// cleanly — day AND night), white clouds with a soft gray base, blue rain streaks,
// a gold lightning bolt, white snow, gray fog. Day/night aware. Drop-in signature
// match with CondIcon (the `color` prop is ignored — these are full-colour like
// the originals).

type Kind =
  | 'tstorm' | 'snow' | 'sleet' | 'rain' | 'showers' | 'fog'
  | 'pcloudyDay' | 'pcloudyNight' | 'cloudy' | 'sun' | 'moon';

function kindOf(p: NwsPeriod): Kind {
  const s = (p.shortForecast || '').toLowerCase();
  const day = p.isDaytime !== false;
  if (/thunder|t-storm|tstm/.test(s)) return 'tstorm';
  if (/snow|flurr|blizzard/.test(s)) return 'snow';
  if (/sleet|ice|freezing|wintry/.test(s)) return 'sleet';
  if (/drizzle|shower/.test(s)) return 'showers';
  if (/rain/.test(s)) return 'rain';
  if (/fog|haze|mist|smoke/.test(s)) return 'fog';
  if (/cloud|overcast/.test(s)) {
    return /partly|mostly sunny|few|mostly clear|isolated|intervals/.test(s)
      ? (day ? 'pcloudyDay' : 'pcloudyNight')
      : 'cloudy';
  }
  if (/sun|clear|fair|hot/.test(s)) return day ? 'sun' : 'moon';
  return day ? 'pcloudyDay' : 'pcloudyNight';
}

export function WeatherscanWx({ p, size = 48 }: { p: NwsPeriod; size?: number; color?: string }) {
  const kind = kindOf(p);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const g = (n: string) => `${uid}${n}`;

  // Gold disc with 12 straight triangular rays — the classic TWC sun.
  const Sun = ({ cx = 50, cy = 47, r = 18 }: { cx?: number; cy?: number; r?: number }) => {
    const base = r + r * 0.2;
    const tip = r + r * 0.72;
    const w = r * 0.17;
    const tri = `${cx - w},${cy - base} ${cx + w},${cy - base} ${cx},${cy - tip}`;
    return (
      <g>
        {Array.from({ length: 12 }, (_, k) => k * 30).map((a) => (
          <polygon key={a} points={tri} transform={`rotate(${a} ${cx} ${cy})`} fill={`url(#${g('ray')})`} />
        ))}
        <circle cx={cx} cy={cy} r={r} fill={`url(#${g('sun')})`} stroke="#F0A400" strokeWidth={0.6} />
        <ellipse cx={cx - r * 0.32} cy={cy - r * 0.36} rx={r * 0.42} ry={r * 0.3} fill="rgba(255,255,255,0.6)" />
      </g>
    );
  };

  // Gold crescent moon, carved from a disc with a mask (renders reliably at any
  // size — the previous path-based crescent collapsed to a sliver).
  const Moon = ({ cx = 50, cy = 47, r = 21, stars = false }: { cx?: number; cy?: number; r?: number; stars?: boolean }) => {
    const mid = g(`moon${Math.round(cx)}`);
    return (
      <g>
        <mask id={mid}>
          <circle cx={cx} cy={cy} r={r} fill="#fff" />
          <circle cx={cx + r * 0.62} cy={cy - r * 0.38} r={r * 0.92} fill="#000" />
        </mask>
        <circle cx={cx} cy={cy} r={r} fill={`url(#${g('moon')})`} mask={`url(#${mid})`} />
        {stars && (
          <g fill="#FFF3B0">
            <path d={star(cx - r * 1.15, cy - r * 0.4, 3)} />
            <path d={star(cx - r * 0.5, cy - r * 1.15, 2.1)} />
          </g>
        )}
      </g>
    );
  };

  // Puffy white cloud with a soft blue-gray base (dark grey for storms).
  const Cloud = ({ dx = 0, dy = 0, s = 1, dark = false }: { dx?: number; dy?: number; s?: number; dark?: boolean }) => (
    <g transform={`translate(${dx} ${dy}) scale(${s})`}>
      <g fill={`url(#${g(dark ? 'dcloud' : 'cloud')})`}>
        <circle cx={36} cy={58} r={16} />
        <circle cx={55} cy={49} r={22} />
        <circle cx={73} cy={58} r={16} />
        <rect x={26} y={58} width={55} height={20} rx={10} />
      </g>
      <ellipse cx={53} cy={44} rx={17} ry={6} fill="rgba(255,255,255,0.55)" />
    </g>
  );

  const Rain = ({ n = 3 }: { n?: number }) => (
    <g stroke={`url(#${g('rain')})`} strokeWidth={4.2} strokeLinecap="round">
      {[41, 55, 69].slice(0, n).map((x, i) => (
        <line key={i} x1={x} y1={81} x2={x - 5} y2={95} />
      ))}
    </g>
  );

  const Flakes = () => (
    <g stroke="#EAF4FF" strokeWidth={2.4} strokeLinecap="round">
      {[42, 56, 70].map((x, i) => (
        <g key={i} transform={`translate(${x} 88)`}>
          <line x1={-4} y1={0} x2={4} y2={0} />
          <line x1={0} y1={-4} x2={0} y2={4} />
          <line x1={-2.8} y1={-2.8} x2={2.8} y2={2.8} />
          <line x1={-2.8} y1={2.8} x2={2.8} y2={-2.8} />
        </g>
      ))}
    </g>
  );

  const Sleet = () => (
    <g>
      <g stroke={`url(#${g('rain')})`} strokeWidth={4.2} strokeLinecap="round">
        <line x1={44} y1={81} x2={39} y2={95} />
        <line x1={70} y1={81} x2={65} y2={95} />
      </g>
      <circle cx={57} cy={90} r={3.4} fill="#EAF4FF" />
    </g>
  );

  const Bolt = () => (
    <path d="M55 60 L44 83 L53 83 L47 100 L68 77 L58 77 L64 60 Z" fill={`url(#${g('bolt')})`} stroke="#E08A00" strokeWidth={0.5} />
  );

  const Fog = () => (
    <g stroke="#B9C4D4" strokeWidth={5} strokeLinecap="round">
      <line x1={30} y1={82} x2={74} y2={82} />
      <line x1={26} y1={92} x2={70} y2={92} />
    </g>
  );

  // Cloud-led icons fill more of the box than a compact sun/moon, so scale them
  // down a touch (centered) to keep every icon a similar visual weight.
  const framed = (node: ReactNode) => (
    <g transform="translate(50 55) scale(0.82) translate(-50 -55)">{node}</g>
  );

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id={g('sun')} cx="40%" cy="36%" r="70%">
          <stop offset="0%" stopColor="#FFF6AE" />
          <stop offset="55%" stopColor="#FFCE2A" />
          <stop offset="100%" stopColor="#FB9E00" />
        </radialGradient>
        <linearGradient id={g('ray')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFDA45" />
          <stop offset="100%" stopColor="#FFAE12" />
        </linearGradient>
        <radialGradient id={g('moon')} cx="38%" cy="34%" r="80%">
          <stop offset="0%" stopColor="#FFF7CE" />
          <stop offset="100%" stopColor="#FFD23A" />
        </radialGradient>
        <linearGradient id={g('cloud')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="62%" stopColor="#EDF2F9" />
          <stop offset="100%" stopColor="#C6D3E4" />
        </linearGradient>
        <linearGradient id={g('dcloud')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B9C3D2" />
          <stop offset="100%" stopColor="#7C8798" />
        </linearGradient>
        <linearGradient id={g('rain')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7FC0F4" />
          <stop offset="100%" stopColor="#2B7BD6" />
        </linearGradient>
        <linearGradient id={g('bolt')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE23A" />
          <stop offset="100%" stopColor="#FFA000" />
        </linearGradient>
      </defs>

      {kind === 'sun' && <Sun />}
      {kind === 'moon' && <Moon r={22} stars />}
      {kind === 'pcloudyDay' && (<><Sun cx={38} cy={38} r={13} />{framed(<Cloud dx={4} dy={12} s={0.92} />)}</>)}
      {kind === 'pcloudyNight' && (<><Moon cx={39} cy={38} r={15} />{framed(<Cloud dx={4} dy={12} s={0.92} />)}</>)}
      {kind === 'cloudy' && framed(<><Cloud dx={-8} dy={-2} s={0.72} dark /><Cloud dy={6} /></>)}
      {kind === 'rain' && framed(<><Cloud dy={-7} /><Rain n={3} /></>)}
      {kind === 'showers' && framed(<><Cloud dy={-7} /><Rain n={2} /></>)}
      {kind === 'snow' && framed(<><Cloud dy={-7} /><Flakes /></>)}
      {kind === 'sleet' && framed(<><Cloud dy={-7} /><Sleet /></>)}
      {kind === 'tstorm' && framed(<><Cloud dy={-9} dark /><Bolt /></>)}
      {kind === 'fog' && framed(<><Cloud dy={-9} /><Fog /></>)}
    </svg>
  );
}

// Small 4-point sparkle star (a diamond with pinched sides) centered at (x,y).
function star(x: number, y: number, r: number): string {
  const t = r * 0.34;
  return `M ${x} ${y - r} Q ${x + t} ${y - t} ${x + r} ${y} Q ${x + t} ${y + t} ${x} ${y + r} Q ${x - t} ${y + t} ${x - r} ${y} Q ${x - t} ${y - t} ${x} ${y - r} Z`;
}
