import { useEffect, useRef, useState } from 'react';
import { convertTemp, type Units } from '../lib/prefs';
import { CondIcon } from './CondIcon';
import type { NwsPeriod } from '../api/nws';

// Hourly forecast as a single graph: per-hour column (time / icon / temp) with a
// smooth temperature curve + dots flowing underneath, aligned to each hour.
// Columns grow to fill the width (with a min so they don't crowd on phones —
// when there isn't room they keep the min width and the row scrolls).
const MIN_COL = 56; // min column width (px)
const CURVE_H = 50; // curve band height
const PAD = 10;

// Catmull-Rom → cubic bézier for a smooth temperature curve.
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function HourlyGraph({ hourly, units }: { hourly: NwsPeriod[]; units: Units }) {
  // Show a full day; columns hold a min width so this overflows into a horizontal
  // scroll (the .hg-scroll wrapper) instead of cramming everything on screen.
  const data = hourly.slice(0, 24);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setCw(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (data.length < 2) return null;

  const n = data.length;
  const col = cw > 0 ? Math.max(MIN_COL, cw / n) : MIN_COL; // fill width, but never below MIN_COL
  const W = col * n;
  const temps = data.map((d) => d.temperature);
  const tMin = Math.min(...temps);
  const tMax = Math.max(...temps);
  const range = Math.max(1, tMax - tMin);
  const pts = temps.map((t, i) => ({ x: i * col + col / 2, y: PAD + (1 - (t - tMin) / range) * (CURVE_H - 2 * PAD) }));
  // Extend flat to both edges so the curve spans end-to-end (dots stay centered).
  const edged = [{ x: 0, y: pts[0].y }, ...pts, { x: W, y: pts[n - 1].y }];
  const line = smoothPath(edged);
  const area = `${line} L ${W.toFixed(1)} ${CURVE_H} L 0 ${CURVE_H} Z`;

  return (
    <div className="card hg-card">
      <div className="hg-scroll" ref={scrollRef}>
        <div className="hg-inner" style={{ width: W }}>
          <div className="hg-cols">
            {data.map((h, i) => {
              const sunny = /sun|clear/i.test(h.shortForecast || '') && h.isDaytime !== false;
              return (
                <div className="hg-col" key={h.startTime} style={{ width: col }}>
                  <div className="hg-hr">{i === 0 ? 'Now' : new Date(h.startTime).toLocaleTimeString([], { hour: 'numeric' })}</div>
                  <CondIcon p={h} size={23} color={sunny ? '#FBBF24' : 'var(--text-muted)'} />
                  <div className="hg-temp">{convertTemp(h.temperature, units)}°</div>
                </div>
              );
            })}
          </div>
          <svg className="hg-svg" width={W} height={CURVE_H} viewBox={`0 0 ${W} ${CURVE_H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="hg-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--primary)" stopOpacity="0.28" />
                <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#hg-fill)" />
            <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => (
              <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="2.8" fill="var(--primary)" stroke="var(--surface)" strokeWidth="1.5" />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
