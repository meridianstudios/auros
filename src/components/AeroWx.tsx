import { useId, type ReactNode } from 'react';
import type { NwsPeriod } from '../api/nws';

// Glossy, colorful "classic 2007" weather icons for the Frutiger Aero style —
// hand-drawn inline SVG (gradient sun, fluffy clouds, blue teardrop rain, gold
// lightning) so they feel straight out of that era. Same condition mapping as
// CondIcon, so it's a drop-in swap. Modern style keeps the flat line icons.

type Kind = 'tstorm' | 'snow' | 'drizzle' | 'rain' | 'fog' | 'pcloudyDay' | 'pcloudyNight' | 'cloudy' | 'sun' | 'moon';

function kindOf(p: NwsPeriod): Kind {
  const s = (p.shortForecast || '').toLowerCase();
  const day = p.isDaytime !== false;
  if (/thunder|t-storm/.test(s)) return 'tstorm';
  if (/snow|sleet|ice|wintry|flurr/.test(s)) return 'snow';
  if (/drizzle/.test(s)) return 'drizzle';
  if (/rain|shower/.test(s)) return 'rain';
  if (/fog|haze|mist/.test(s)) return 'fog';
  if (/cloud|overcast/.test(s)) return /partly|mostly sunny|few|mostly clear/.test(s) ? (day ? 'pcloudyDay' : 'pcloudyNight') : 'cloudy';
  if (/sun|clear/.test(s)) return day ? 'sun' : 'moon';
  return day ? 'pcloudyDay' : 'pcloudyNight';
}

// `color` is accepted for a drop-in signature match with CondIcon but ignored —
// these icons are intentionally full-color.
export function AeroWx({ p, size = 48 }: { p: NwsPeriod; size?: number; color?: string }) {
  const kind = kindOf(p);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const g = (n: string) => `${uid}${n}`;
  const storm = kind === 'tstorm';

  const Sun = ({ cx = 50, cy = 48, r = 18 }: { cx?: number; cy?: number; r?: number }) => {
    // Many short tapered gold spikes, detached from a glossy orange sphere.
    const baseD = r + r * 0.14; // spike base sits just off the disc edge
    const len = r * 0.5;        // spike length
    const half = r * 0.13;      // half-width of the spike base
    const spike = `${cx - half},${cy - baseD} ${cx + half},${cy - baseD} ${cx},${cy - baseD - len}`;
    const angles = Array.from({ length: 16 }, (_, k) => k * 22.5);
    return (
      <g>
        {angles.map((a) => (
          <polygon key={a} points={spike} transform={`rotate(${a} ${cx} ${cy})`} fill={`url(#${g('ray')})`} />
        ))}
        <circle cx={cx} cy={cy} r={r} fill={`url(#${g('sun')})`} />
        <ellipse cx={cx + r * 0.26} cy={cy + r * 0.32} rx={r * 0.34} ry={r * 0.22} fill="rgba(233,120,10,0.4)" />
        <ellipse cx={cx - r * 0.3} cy={cy - r * 0.4} rx={r * 0.46} ry={r * 0.32} fill="rgba(255,255,255,0.68)" />
      </g>
    );
  };

  // Crescent carved from a disc with a mask — renders cleanly at any size (the old
  // path crescent collapsed to an invisible sliver on the small night icons).
  const Moon = ({ cx = 52, cy = 48, r = 22 }: { cx?: number; cy?: number; r?: number }) => {
    const mid = g(`mmask${Math.round(cx)}`);
    return (
      <g>
        <mask id={mid}>
          <circle cx={cx} cy={cy} r={r} fill="#fff" />
          <circle cx={cx + r * 0.6} cy={cy - r * 0.36} r={r * 0.92} fill="#000" />
        </mask>
        <circle cx={cx} cy={cy} r={r} fill={`url(#${g('moon')})`} mask={`url(#${mid})`} />
        <g fill="#ffffff">
          <circle cx={cx - r * 1.05} cy={cy - r * 0.5} r={1.6} />
          <circle cx={cx - r * 0.55} cy={cy - r * 1.05} r={1.2} />
          <circle cx={cx + r * 0.1} cy={cy - r * 0.9} r={1.4} />
        </g>
      </g>
    );
  };

  const Cloud = ({ dx = 0, dy = 0, s = 1 }: { dx?: number; dy?: number; s?: number }) => (
    <g transform={`translate(${dx} ${dy}) scale(${s})`}>
      <g fill={`url(#${g(storm ? 'scloud' : 'cloud')})`}>
        <circle cx={37} cy={57} r={15} />
        <circle cx={56} cy={50} r={21} />
        <circle cx={72} cy={59} r={15} />
        <rect x={28} y={59} width={52} height={19} rx={9.5} />
      </g>
      <ellipse cx={55} cy={43} rx={16} ry={6} fill="rgba(255,255,255,0.5)" />
    </g>
  );

  const Drops = ({ n = 3 }: { n?: number }) => (
    <g fill={`url(#${g('drop')})`}>
      {[40, 54, 68].slice(0, n).map((x, i) => (
        <path key={i} d="M0,-6 C -3.6,-0.5 -3.6,4.5 0,4.5 C 3.6,4.5 3.6,-0.5 0,-6 Z" transform={`translate(${x} 88)`} />
      ))}
    </g>
  );

  const Flakes = () => (
    <g fill="#f0f8ff" stroke="#b9d6f4" strokeWidth={1}>
      {[42, 56, 70].map((x, i) => (
        <circle key={i} cx={x} cy={89} r={3.6} />
      ))}
    </g>
  );

  const Bolt = () => (
    <path d="M56 66 L45 86 L54 86 L49 99 L67 79 L57 79 L63 66 Z" fill={`url(#${g('bolt')})`} stroke="rgba(255,160,0,0.6)" strokeWidth={0.5} />
  );

  const Fog = () => (
    <g stroke="rgba(150,170,196,0.9)" strokeWidth={5} strokeLinecap="round">
      <line x1={33} y1={85} x2={77} y2={85} />
      <line x1={30} y1={95} x2={70} y2={95} />
    </g>
  );

  // Cloud-based icons fill more of the box than a compact sun disc, so scale them
  // down (centered) to keep every icon a similar visual size in the forecast rows.
  const cloud = (node: ReactNode) => (
    <g transform="translate(50 54) scale(0.84) translate(-50 -54)">{node}</g>
  );

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id={g('sun')} cx="42%" cy="38%" r="66%">
          <stop offset="0%" stopColor="#FFF7B8" />
          <stop offset="55%" stopColor="#FFCE3A" />
          <stop offset="100%" stopColor="#FB8C00" />
        </radialGradient>
        <linearGradient id={g('ray')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE884" />
          <stop offset="55%" stopColor="#FFC021" />
          <stop offset="100%" stopColor="#FFA412" />
        </linearGradient>
        <linearGradient id={g('cloud')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#CFDDEC" />
        </linearGradient>
        <linearGradient id={g('scloud')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C2CDDC" />
          <stop offset="100%" stopColor="#8794A8" />
        </linearGradient>
        <linearGradient id={g('moon')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FCF3B8" />
          <stop offset="100%" stopColor="#E6D25E" />
        </linearGradient>
        <linearGradient id={g('drop')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8FC8F7" />
          <stop offset="100%" stopColor="#2C7BD6" />
        </linearGradient>
        <linearGradient id={g('bolt')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE23A" />
          <stop offset="100%" stopColor="#FFA000" />
        </linearGradient>
      </defs>

      {kind === 'sun' && <Sun />}
      {kind === 'moon' && <Moon />}
      {kind === 'pcloudyDay' && (<><Sun cx={37} cy={39} r={13} /><Cloud dx={6} dy={13} s={0.9} /></>)}
      {kind === 'pcloudyNight' && (<><Moon cx={38} cy={38} r={15} /><Cloud dx={6} dy={13} s={0.9} /></>)}
      {kind === 'cloudy' && cloud(<Cloud dy={4} />)}
      {kind === 'rain' && cloud(<><Cloud dy={-6} /><Drops n={3} /></>)}
      {kind === 'drizzle' && cloud(<><Cloud dy={-6} /><Drops n={2} /></>)}
      {kind === 'snow' && cloud(<><Cloud dy={-6} /><Flakes /></>)}
      {kind === 'tstorm' && cloud(<><Cloud dy={-8} /><Bolt /></>)}
      {kind === 'fog' && cloud(<><Cloud dy={-8} /><Fog /></>)}
    </svg>
  );
}
