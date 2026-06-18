import { useMemo } from 'react';
import { useLocations } from '../context/LocationsContext';
import { NWR_STATIONS } from '../data/nwrStations';
import { haversineMiles } from '../utils/geo';

const STATUS = {
  normal: { label: 'On air', color: 'var(--success)' },
  degraded: { label: 'Degraded', color: 'var(--warning)' },
  unknown: { label: 'Unknown', color: 'var(--text-muted)' },
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
    <div className="view">
      <div className="bar">
        <h1>NOAA Weather Radio</h1>
        <p>Transmitters near {selected.name}</p>
      </div>
      <div className="pad" style={{ paddingTop: 12 }}>
        <div className="card">
          <span className="muted">
            Tune a NWR radio to the nearest transmitter you can receive clearly (~50 mi range). Pick the strongest
            signal and confirm it names your county in the broadcast loop.
          </span>
        </div>

        <div className="section">TRANSMITTERS BY DISTANCE</div>
        {ranked.map((s) => {
          const st = STATUS[s.status];
          return (
            <div key={s.callSign} className={`card ${s.recommended ? 'recommended' : ''}`}>
              <div className="nwr-head">
                <span className="nwr-freq">
                  {s.freqMHz ? s.freqMHz.toFixed(3) : '—'} {s.channel !== '—' ? `· ${s.channel}` : ''}
                </span>
                <span className="status" style={{ color: st.color }}>
                  <span className="dot" style={{ background: st.color }} /> {st.label}
                </span>
              </div>
              <div style={{ marginTop: 4 }}>{s.location} · {s.callSign}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>~{Math.round(s.miles)} mi away</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{s.counties}</div>
              {s.note && <div className="muted" style={{ fontSize: 12, marginTop: 8, fontStyle: 'italic' }}>{s.note}</div>}
              {s.recommended && <div className="tag-rec">★ Recommended — best signal here</div>}
            </div>
          );
        })}

        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <a href="https://www.weather.gov/nwr/" target="_blank" rel="noreferrer">Live NWR outage info (weather.gov) ↗</a>
        </div>
        <div className="muted" style={{ textAlign: 'center', fontSize: 11, marginTop: 10 }}>
          Status is curated, not live. Always confirm with the official outage page.
        </div>
      </div>
    </div>
  );
}
