import { convertTemp, type Units } from '../lib/prefs';
import type { NwsPeriod } from '../api/nws';

// Compact 24-hour temperature line + precip-chance bars, drawn from the hourly
// data Home already fetches. SVG stretches to fill width (non-scaling stroke,
// no in-SVG text) so it never distorts; labels are HTML.
export function TrendChart({ hourly, units }: { hourly: NwsPeriod[]; units: Units }) {
  const data = hourly.slice(0, 24);
  if (data.length < 3) return null;

  const n = data.length;
  const temps = data.map((d) => d.temperature);
  const pops = data.map((d) => d.probabilityOfPrecipitation?.value ?? 0);
  const tMin = Math.min(...temps);
  const tMax = Math.max(...temps);
  const tRange = Math.max(1, tMax - tMin);

  const x = (i: number) => (i / (n - 1)) * 100;
  const TOP = 3, BOT = 26;
  const yT = (t: number) => TOP + (1 - (t - tMin) / tRange) * (BOT - TOP);
  const line = temps.map((t, i) => `${x(i).toFixed(2)},${yT(t).toFixed(2)}`).join(' ');
  const area = `0,${BOT} ${line} 100,${BOT}`;

  const BASE = 40, MAXBAR = 11, bw = (100 / n) * 0.55;
  const labelIdx = [0, Math.round(n / 4), Math.round(n / 2), Math.round((3 * n) / 4), n - 1]
    .filter((v, i, a) => v < n && a.indexOf(v) === i);

  return (
    <div className="trend-card card">
      <div className="trend-head">
        <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
            <i style={{ display: 'inline-block', width: 10, height: 2, borderRadius: 2, background: 'var(--primary)' }} /> Temp
          </span>
          <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
            <i style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 1, background: 'var(--accent)', opacity: 0.5 }} /> Precip
          </span>
        </span>
        <span className="trend-range">↑ {convertTemp(tMax, units)}°&nbsp;&nbsp;↓ {convertTemp(tMin, units)}°</span>
      </div>
      <svg className="trend-svg" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="trendfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0.3" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {pops.map((p, i) =>
          p >= 5 ? (
            <rect
              key={i}
              x={(x(i) - bw / 2).toFixed(2)}
              y={(BASE - (p / 100) * MAXBAR).toFixed(2)}
              width={bw.toFixed(2)}
              height={((p / 100) * MAXBAR).toFixed(2)}
              fill="var(--accent)"
              opacity="0.4"
            />
          ) : null
        )}
        <polygon points={area} fill="url(#trendfill)" />
        <polyline points={line} fill="none" stroke="var(--primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="trend-axis">
        {labelIdx.map((i) => (
          <span key={i}>{i === 0 ? 'Now' : new Date(data[i].startTime).toLocaleTimeString([], { hour: 'numeric' })}</span>
        ))}
      </div>
    </div>
  );
}
