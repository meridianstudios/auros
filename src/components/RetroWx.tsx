import { type ReactNode } from 'react';
import type { NwsPeriod } from '../api/nws';

// Flat, chunky "90s Weather Channel" weather icons for the retro style — solid
// gold sun with an orange outline, flat clouds, cyan rain, yellow lightning.
// Same condition mapping as CondIcon/AeroWx, so it's a drop-in swap.

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

export function RetroWx({ p, size = 48 }: { p: NwsPeriod; size?: number; color?: string }) {
  const kind = kindOf(p);
  const storm = kind === 'tstorm';

  const Sun = ({ cx = 50, cy = 48, r = 17 }: { cx?: number; cy?: number; r?: number }) => {
    const baseD = r + 3;
    const len = r * 0.55;
    const half = r * 0.17;
    const spike = `${cx - half},${cy - baseD} ${cx + half},${cy - baseD} ${cx},${cy - baseD - len}`;
    return (
      <g>
        {Array.from({ length: 12 }, (_, k) => k * 30).map((a) => (
          <polygon key={a} points={spike} transform={`rotate(${a} ${cx} ${cy})`} fill="#f6b81a" />
        ))}
        <circle cx={cx} cy={cy} r={r} fill="#ffcf2e" stroke="#e08a12" strokeWidth={2} />
      </g>
    );
  };

  const Moon = ({ cx = 52, cy = 48, r = 22 }: { cx?: number; cy?: number; r?: number }) => (
    <path
      d={`M ${cx + r * 0.55} ${cy - r} A ${r} ${r} 0 1 0 ${cx + r * 0.55} ${cy + r} A ${r * 0.82} ${r * 0.82} 0 1 1 ${cx + r * 0.55} ${cy - r} Z`}
      fill="#f5d24a"
      stroke="#d9a81e"
      strokeWidth={2}
    />
  );

  const Cloud = ({ dx = 0, dy = 0, s = 1 }: { dx?: number; dy?: number; s?: number }) => (
    <g transform={`translate(${dx} ${dy}) scale(${s})`} fill={storm ? '#9aa6c4' : '#e9effb'}>
      <circle cx={37} cy={57} r={15} />
      <circle cx={56} cy={50} r={21} />
      <circle cx={72} cy={59} r={15} />
      <rect x={28} y={59} width={52} height={19} rx={9} />
    </g>
  );

  const Drops = ({ n = 3 }: { n?: number }) => (
    <g stroke="#7fd6ff" strokeWidth={4.5} strokeLinecap="round">
      {[40, 54, 68].slice(0, n).map((x, i) => (
        <line key={i} x1={x} y1={82} x2={x - 3} y2={94} />
      ))}
    </g>
  );

  const Flakes = () => (
    <g fill="#eaf4ff">
      {[42, 56, 70].map((x, i) => (
        <circle key={i} cx={x} cy={89} r={3.4} />
      ))}
    </g>
  );

  const Bolt = () => <polygon points="56,66 46,85 54,85 49,98 66,80 57,80 62,66" fill="#ffd21a" stroke="#e0a010" strokeWidth={1.5} />;

  const Fog = () => (
    <g stroke="#c3ccdf" strokeWidth={5} strokeLinecap="round">
      <line x1={33} y1={85} x2={77} y2={85} />
      <line x1={30} y1={95} x2={70} y2={95} />
    </g>
  );

  const wrap = (node: ReactNode) => <g transform="translate(50 54) scale(0.84) translate(-50 -54)">{node}</g>;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      {kind === 'sun' && <Sun />}
      {kind === 'moon' && <Moon />}
      {kind === 'pcloudyDay' && (<><Sun cx={37} cy={39} r={13} /><Cloud dx={6} dy={13} s={0.9} /></>)}
      {kind === 'pcloudyNight' && (<><Moon cx={38} cy={38} r={14} /><Cloud dx={6} dy={13} s={0.9} /></>)}
      {kind === 'cloudy' && wrap(<Cloud dy={4} />)}
      {kind === 'rain' && wrap(<><Cloud dy={-6} /><Drops n={3} /></>)}
      {kind === 'drizzle' && wrap(<><Cloud dy={-6} /><Drops n={2} /></>)}
      {kind === 'snow' && wrap(<><Cloud dy={-6} /><Flakes /></>)}
      {kind === 'tstorm' && wrap(<><Cloud dy={-8} /><Bolt /></>)}
      {kind === 'fog' && wrap(<><Cloud dy={-8} /><Fog /></>)}
    </svg>
  );
}
