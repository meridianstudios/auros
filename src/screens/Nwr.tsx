import { useMemo } from 'react';
import { Star, ExternalLink, Volume2, TriangleAlert } from 'lucide-react';
import { useLocations } from '../context/LocationsContext';
import { NWR_STATIONS } from '../data/nwrStations';
import { haversineMiles } from '../utils/geo';

// NOAA Weather Radio channel numbers by frequency.
const CHANNEL: Record<string, string> = {
  '162.400': 'WX2', '162.425': 'WX4', '162.450': 'WX5', '162.475': 'WX3',
  '162.500': 'WX6', '162.525': 'WX7', '162.550': 'WX1',
};

// Status shrinks a transmitter's effective reach (a "reduced range" site barely
// carries past its tower; an out-of-service one not at all).
const POWER_FACTOR: Record<string, number> = { normal: 1, degraded: 0.1, unknown: 0.02 };

// Reception is a function of power AND distance, not distance alone — a distant
// 1000 W transmitter usually beats a nearby 300 W one. Range ≈ 45 mi at 1000 W,
// scaling with √power (received signal falls off with distance²).
function reception(s: { status: string; power?: number; miles: number }) {
  if (s.status === 'unknown') return { label: 'Out of service', color: 'var(--danger)' };
  if (s.status === 'degraded') return { label: 'Reduced range', color: 'var(--warning)' };
  const rangeMi = 45 * Math.sqrt((s.power || 300) / 1000);
  const r = s.miles / rangeMi;
  if (r <= 0.7) return { label: 'Strong signal', color: 'var(--success)' };
  if (r <= 1.0) return { label: 'Good signal', color: 'var(--success)' };
  if (r <= 1.4) return { label: 'Fringe — may fade', color: 'var(--warning)' };
  return { label: 'Likely too far', color: 'var(--text-dim)' };
}
const sigScore = (s: { status: string; power?: number; miles: number }) =>
  ((s.power || 300) * POWER_FACTOR[s.status]) / (s.miles * s.miles);

export function Nwr() {
  const { selected } = useLocations();

  // Take the nearest transmitters, then rank them by *estimated signal* (power +
  // distance + status) rather than raw distance.
  const ranked = useMemo(() => {
    const withMiles = NWR_STATIONS.map((s) => ({
      ...s,
      miles: haversineMiles(selected.lat, selected.lon, s.lat, s.lon),
    })).sort((a, b) => a.miles - b.miles);
    return withMiles
      .slice(0, 15)
      .map((s) => ({ ...s, rec: reception(s), score: sigScore(s) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [selected.lat, selected.lon]);

  // Marginal = even the best option isn't a solid signal.
  const marginal = ranked.length > 0 && !['Strong signal', 'Good signal'].includes(ranked[0].rec.label);
  // Best-signal transmitter that also offers a live online stream.
  const live = ranked.find((s) => s.stream);

  return (
    <div className="view fade">
      <div className="topbar">
        <h1>Weather Radio</h1>
        <p>Transmitters near {selected.name}</p>
      </div>
      <div className="pad">
        <div className="card">
          <div className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
            Closer isn't always clearer — a higher-power transmitter often beats a nearer weak one. These are ranked
            by estimated signal for {selected.name}. Tune to the strongest you can actually receive and confirm it
            names your county in the broadcast loop.
          </div>
        </div>

        {marginal && (
          <div className="card" style={{ display: 'flex', gap: 12, background: 'color-mix(in srgb, var(--warning) 11%, var(--surface))', borderColor: 'color-mix(in srgb, var(--warning) 35%, var(--border))' }}>
            <span style={{ color: 'var(--warning)', flex: 'none', marginTop: 1 }}><TriangleAlert size={18} /></span>
            <div style={{ fontSize: 13, lineHeight: 1.55 }}>
              <b>Reception looks marginal here.</b> Every nearby transmitter is distant or reduced-power, so expect
              static — especially indoors. An outdoor or external antenna helps a lot. A SAME-equipped radio will
              still alarm whenever a usable signal breaks through.
            </div>
          </div>
        )}

        {live && (
          <>
            <div className="label">Listen live</div>
            <a
              className="card"
              href={live.stream}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', color: 'var(--text)' }}
            >
              <span style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', background: 'color-mix(in srgb, var(--primary) 16%, transparent)', color: 'var(--primary)' }}>
                <Volume2 size={20} />
              </span>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{live.city}, {live.st} · {live.freq.toFixed(3)}</div>
                <div className="muted" style={{ fontSize: 13 }}>Live audio stream ↗</div>
              </div>
            </a>
            <div className="dim" style={{ fontSize: 11, marginBottom: 4, lineHeight: 1.5 }}>
              Third-party stream — can lag 10s–2 min and won't alarm on its own.
            </div>
          </>
        )}

        <div className="label">By estimated signal</div>
        {ranked.map((s, i) => {
          const ch = CHANNEL[s.freq.toFixed(3)];
          const best = i === 0;
          return (
            <div key={s.call} className="card" style={best ? { boxShadow: '0 0 0 1.5px var(--primary), 0 8px 24px -16px var(--shadow)' } : undefined}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>
                  {s.freq.toFixed(3)} {ch && <span className="dim" style={{ fontSize: 13, fontWeight: 500 }}>{ch}</span>}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: s.rec.color, fontWeight: 600, fontSize: 13 }}>
                  <span className="dot" style={{ background: s.rec.color }} /> {s.rec.label}
                </span>
              </div>
              <div style={{ marginTop: 4, fontSize: 14 }}>{s.city}, {s.st} · {s.call}</div>
              <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>
                ~{Math.round(s.miles)} mi{s.power ? ` · ${s.power} W` : ''}{s.wfo ? ` · NWS ${s.wfo}` : ''}
              </div>
              {best && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, color: 'var(--primary)', fontWeight: 600, fontSize: 12.5 }}>
                  <Star size={14} fill="currentColor" /> Best estimated signal here
                </div>
              )}
            </div>
          );
        })}

        <a
          href="https://www.weather.gov/nwr/"
          target="_blank"
          rel="noreferrer"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6, fontWeight: 600, fontSize: 14 }}
        >
          Full coverage &amp; live outages <ExternalLink size={14} />
        </a>
        <div className="dim" style={{ textAlign: 'center', fontSize: 11, marginTop: 10 }}>
          Signal is estimated from transmitter power, distance, and NWS status — terrain and antenna matter too. Confirm by ear.
        </div>
      </div>
    </div>
  );
}
