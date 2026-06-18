import { useMemo } from 'react';
import { Star, ExternalLink, Volume2 } from 'lucide-react';
import { useLocations } from '../context/LocationsContext';
import { NWR_STATIONS } from '../data/nwrStations';
import { haversineMiles } from '../utils/geo';

const STATUS = {
  normal: { label: 'On air', color: 'var(--success)' },
  degraded: { label: 'Degraded', color: 'var(--warning)' },
  unknown: { label: 'Unknown', color: 'var(--text-dim)' },
};

export function Nwr() {
  const { selected } = useLocations();
  const ranked = useMemo(
    () =>
      NWR_STATIONS.map((s) => ({ ...s, miles: haversineMiles(selected.lat, selected.lon, s.lat, s.lon) })).sort(
        (a, b) => a.miles - b.miles
      ),
    [selected.lat, selected.lon]
  );

  return (
    <div className="view fade">
      <div className="topbar">
        <h1>Weather Radio</h1>
        <p>Transmitters near {selected.name}</p>
      </div>
      <div className="pad">
        <div className="card">
          <div className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
            Tune a NWR radio to the nearest transmitter you can receive clearly (~50 mi range). Pick the strongest
            signal and confirm it names your county in the broadcast loop.
          </div>
        </div>

        <div className="label">Listen live</div>
        <a
          className="card"
          href="https://www.broadcastify.com/listen/feed/34945"
          target="_blank"
          rel="noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', color: 'var(--text)' }}
        >
          <span style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', background: 'color-mix(in srgb, var(--primary) 16%, transparent)', color: 'var(--primary)' }}>
            <Volume2 size={20} />
          </span>
          <div className="grow">
            <div style={{ fontWeight: 600 }}>Kalamazoo Area NWR · 162.475</div>
            <div className="muted" style={{ fontSize: 13 }}>Live audio stream (Broadcastify) ↗</div>
          </div>
        </a>
        <div className="dim" style={{ fontSize: 11, marginBottom: 4, lineHeight: 1.5 }}>
          Third-party stream — can lag 10s–2 min and won't alarm on its own. Not for life-safety; that's your radio + WEA.
        </div>

        <div className="label">By distance</div>
        {ranked.map((s) => {
          const st = STATUS[s.status];
          return (
            <div key={s.callSign} className="card" style={s.recommended ? { boxShadow: '0 0 0 1.5px var(--primary), 0 8px 24px -16px var(--shadow)' } : undefined}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>
                  {s.freqMHz ? s.freqMHz.toFixed(3) : '—'} <span className="dim" style={{ fontSize: 13, fontWeight: 500 }}>{s.channel !== '—' ? s.channel : ''}</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: st.color, fontWeight: 600, fontSize: 13 }}>
                  <span className="dot" style={{ background: st.color }} /> {st.label}
                </span>
              </div>
              <div style={{ marginTop: 4, fontSize: 14 }}>{s.location} · {s.callSign}</div>
              <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>~{Math.round(s.miles)} mi · {s.counties}</div>
              {s.note && <div className="muted" style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.5 }}>{s.note}</div>}
              {s.recommended && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, color: 'var(--primary)', fontWeight: 600, fontSize: 12.5 }}>
                  <Star size={14} fill="currentColor" /> Recommended — best signal here
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
          Live NWR outage info <ExternalLink size={14} />
        </a>
        <div className="dim" style={{ textAlign: 'center', fontSize: 11, marginTop: 10 }}>
          Status is curated, not live. Confirm with the official outage page.
        </div>
      </div>
    </div>
  );
}
