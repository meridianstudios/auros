import { useMemo } from 'react';
import { Star, ExternalLink, Volume2 } from 'lucide-react';
import { useLocations } from '../context/LocationsContext';
import { NWR_STATIONS } from '../data/nwrStations';
import { haversineMiles } from '../utils/geo';

const STATUS = {
  normal: { label: 'On air', color: 'var(--success)' },
  degraded: { label: 'Reduced range', color: 'var(--warning)' },
  unknown: { label: 'Out of service', color: 'var(--danger)' },
};

// NOAA Weather Radio channel numbers by frequency.
const CHANNEL: Record<string, string> = {
  '162.400': 'WX2', '162.425': 'WX4', '162.450': 'WX5', '162.475': 'WX3',
  '162.500': 'WX6', '162.525': 'WX7', '162.550': 'WX1',
};

export function Nwr() {
  const { selected } = useLocations();
  const ranked = useMemo(
    () =>
      NWR_STATIONS.map((s) => ({ ...s, miles: haversineMiles(selected.lat, selected.lon, s.lat, s.lon) }))
        .sort((a, b) => a.miles - b.miles)
        .slice(0, 8),
    [selected.lat, selected.lon]
  );

  // Nearest transmitter that offers a live online stream.
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
            Tune a NOAA Weather Radio to the nearest transmitter you can receive clearly (~40 mi typical range).
            Pick the strongest signal and confirm it names your county in the broadcast loop.
          </div>
        </div>

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
              Third-party stream — can lag 10s–2 min and won't alarm on its own. Not for life-safety; that's your radio + WEA.
            </div>
          </>
        )}

        <div className="label">By distance</div>
        {ranked.map((s, i) => {
          const st = STATUS[s.status];
          const ch = CHANNEL[s.freq.toFixed(3)];
          const nearest = i === 0;
          return (
            <div key={s.call} className="card" style={nearest ? { boxShadow: '0 0 0 1.5px var(--primary), 0 8px 24px -16px var(--shadow)' } : undefined}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>
                  {s.freq.toFixed(3)} {ch && <span className="dim" style={{ fontSize: 13, fontWeight: 500 }}>{ch}</span>}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: st.color, fontWeight: 600, fontSize: 13 }}>
                  <span className="dot" style={{ background: st.color }} /> {st.label}
                </span>
              </div>
              <div style={{ marginTop: 4, fontSize: 14 }}>{s.city}, {s.st} · {s.call}</div>
              <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>
                ~{Math.round(s.miles)} mi{s.power ? ` · ${s.power} W` : ''}{s.wfo ? ` · NWS ${s.wfo}` : ''}
              </div>
              {nearest && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, color: 'var(--primary)', fontWeight: 600, fontSize: 12.5 }}>
                  <Star size={14} fill="currentColor" /> Nearest — strongest signal likely
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
          Status reflects NWS data at last update. Confirm with the official outage page.
        </div>
      </div>
    </div>
  );
}
