import { useRef, useState } from 'react';
import { CircleCheck, Circle, Trash2, Navigation, MapPin } from 'lucide-react';
import { useLocations } from '../context/LocationsContext';
import { searchPlaces, type GeocodeResult } from '../api/geocode';

export function Locations() {
  const { locations, selectedId, selected, select, remove, addByCurrentPosition, addPlace } = useLocations();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [busy, setBusy] = useState<null | 'gps' | 'search'>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const useGps = async () => {
    setBusy('gps'); setMsg(null);
    try { await addByCurrentPosition(); } catch (e: any) { setMsg(e?.message ?? 'Could not get location'); }
    finally { setBusy(null); }
  };

  const onQuery = (v: string) => {
    setQuery(v); setMsg(null);
    window.clearTimeout(timer.current);
    if (v.trim().length < 2) { setResults([]); setBusy(null); return; }
    setBusy('search');
    timer.current = window.setTimeout(async () => {
      try { setResults(await searchPlaces(v.trim(), 6, { lat: selected.lat, lon: selected.lon })); }
      catch { setResults([]); }
      finally { setBusy(null); }
    }, 250);
  };

  const pick = (r: GeocodeResult) => { addPlace(r); setQuery(''); setResults([]); };

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
          <div className="dim" style={{ fontSize: 13, margin: '16px 0 8px' }}>Or search a city, place, or address</div>
          <input
            className="input"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Start typing… address, town, or county"
            onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) pick(results[0]); }}
            autoComplete="off"
          />
          {busy === 'search' && <div className="dim" style={{ fontSize: 13, marginTop: 8 }}>Searching…</div>}
          {results.length > 0 && (
            <div className="group" style={{ marginTop: 10 }}>
              {results.map((r, i) => (
                <button key={`${r.lat},${r.lon},${i}`} className="item" style={{ width: '100%', textAlign: 'left' }} onClick={() => pick(r)}>
                  <span className="ic"><MapPin size={18} /></span>
                  <span className="grow"><span className="t">{r.name}</span></span>
                  {r.kind && <span className="dim" style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.3, flex: 'none' }}>{r.kind}</span>}
                </button>
              ))}
            </div>
          )}
          {msg && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{msg}</div>}
        </div>
      </div>
    </div>
  );
}
