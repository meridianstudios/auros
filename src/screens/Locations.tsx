import { useState } from 'react';
import { useLocations } from '../context/LocationsContext';

export function Locations() {
  const { locations, selectedId, select, remove, addByCurrentPosition, addByName } = useLocations();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<null | 'gps' | 'search'>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const useGps = async () => {
    setBusy('gps'); setMsg(null);
    try { await addByCurrentPosition(); } catch (e: any) { setMsg(e?.message ?? 'Could not get location'); }
    finally { setBusy(null); }
  };

  const search = async () => {
    if (!query.trim()) return;
    setBusy('search'); setMsg(null);
    try { await addByName(query.trim()); setQuery(''); } catch (e: any) { setMsg(e?.message ?? 'No match'); }
    finally { setBusy(null); }
  };

  return (
    <div className="view">
      <div className="bar">
        <h1>Locations</h1>
        <p>Track multiple places · tap to make active</p>
      </div>
      <div className="pad" style={{ paddingTop: 12 }}>
        <div className="section">SAVED</div>
        {locations.map((l) => (
          <div key={l.id} className="card">
            <div className="loc-item">
              <button
                className="loc-item"
                style={{ flex: 1, background: 'none', color: 'var(--text)', textAlign: 'left', padding: 0 }}
                onClick={() => select(l.id)}
              >
                <span style={{ color: l.id === selectedId ? 'var(--primary)' : 'var(--text-muted)', fontSize: 18 }}>
                  {l.id === selectedId ? '◉' : '○'}
                </span>
                <span>
                  <span className="name">{l.name}</span>
                  <br />
                  <span className="coord">{l.lat.toFixed(3)}, {l.lon.toFixed(3)}</span>
                </span>
              </button>
              {locations.length > 1 && (
                <button style={{ background: 'none', color: 'var(--danger)', fontSize: 16 }} onClick={() => remove(l.id)}>🗑</button>
              )}
            </div>
          </div>
        ))}

        <div className="section">ADD A LOCATION</div>
        <div className="card">
          <button className="btn btn-primary" onClick={useGps} disabled={busy === 'gps'}>
            {busy === 'gps' ? 'Locating…' : '📍 Use my current location'}
          </button>
          <div className="muted" style={{ fontSize: 12, margin: '16px 0 6px' }}>Or search by city / place</div>
          <div className="row">
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Kalamazoo, MI"
              onKeyDown={(e) => e.key === 'Enter' && search()}
            />
            <button className="btn btn-ghost" onClick={search} disabled={busy === 'search'} style={{ width: 54 }}>
              {busy === 'search' ? '…' : '🔍'}
            </button>
          </div>
          {msg && <div className="muted" style={{ fontSize: 12, marginTop: 10, color: 'var(--danger)' }}>{msg}</div>}
        </div>
      </div>
    </div>
  );
}
