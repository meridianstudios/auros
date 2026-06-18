import { useState } from 'react';
import { CircleCheck, Circle, Trash2, Navigation, Search } from 'lucide-react';
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
    <div className="view fade">
      <div className="topbar">
        <h1>Locations</h1>
        <p>Tap a place to make it active</p>
      </div>
      <div className="pad">
        <div className="label">Saved</div>
        <div className="group">
          {locations.map((l) => {
            const active = l.id === selectedId;
            return (
              <div key={l.id} className="item">
                <button className="grow" style={{ display: 'flex', alignItems: 'center', gap: 14 }} onClick={() => select(l.id)}>
                  <span className="ic" style={{ color: active ? 'var(--primary)' : 'var(--text-dim)' }}>
                    {active ? <CircleCheck size={20} /> : <Circle size={20} />}
                  </span>
                  <span className="grow">
                    <span className="t" style={{ display: 'block' }}>{l.name}</span>
                    <span className="s" style={{ fontVariantNumeric: 'tabular-nums' }}>{l.lat.toFixed(3)}, {l.lon.toFixed(3)}</span>
                  </span>
                </button>
                {locations.length > 1 && (
                  <button className="ic" style={{ color: 'var(--text-dim)' }} onClick={() => remove(l.id)} aria-label="Remove">
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="label">Add a location</div>
        <div className="card">
          <button className="btn btn-primary" onClick={useGps} disabled={busy === 'gps'}>
            <Navigation size={16} /> {busy === 'gps' ? 'Locating…' : 'Use my current location'}
          </button>
          <div className="dim" style={{ fontSize: 13, margin: '16px 0 8px' }}>Or search by city / place</div>
          <div className="row">
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Kalamazoo, MI"
              onKeyDown={(e) => e.key === 'Enter' && search()}
            />
            <button className="btn btn-ghost" style={{ width: 52, flex: 'none' }} onClick={search} disabled={busy === 'search'} aria-label="Search">
              <Search size={18} />
            </button>
          </div>
          {msg && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{msg}</div>}
        </div>
      </div>
    </div>
  );
}
