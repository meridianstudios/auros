// Geocoding for "search by place".
// Primary: Photon (photon.komoot.io) — OpenStreetMap-based, CORS-enabled, built
// for type-ahead. Returns houses, streets, townships, counties, towns, etc.
// Fallback: Open-Meteo (towns/cities only) if Photon is unreachable.

export interface GeocodeResult {
  name: string;
  lat: number;
  lon: number;
  kind?: string; // e.g. "Address", "Township", "County", "City"
}

// NWS only covers the US + territories — prefer those results.
const US_CC = new Set(['us', 'pr', 'vi', 'gu', 'as', 'mp']);

const STATE_ABBR: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', 'District of Columbia': 'DC',
  Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL',
  Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA',
  Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN',
  Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK',
  Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT',
  Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI',
  Wyoming: 'WY', 'Puerto Rico': 'PR', 'United States Virgin Islands': 'VI', Guam: 'GU',
};

const hasSuffix = (c: string) => /\b(County|Parish|Borough|Census Area|Municipality)\b/i.test(c);
const fmtCounty = (c?: string) => (c ? (hasSuffix(c) ? c : `${c} County`) : '');

function kindOf(p: any): string {
  if (p.housenumber) return 'Address';
  const v = p.osm_value;
  const named: Record<string, string> = {
    city: 'City', town: 'Town', village: 'Village', hamlet: 'Hamlet',
    county: 'County', state: 'State', suburb: 'Suburb', neighbourhood: 'Neighborhood',
    locality: 'Locality', municipality: 'Municipality',
  };
  if (named[v]) return named[v];
  if (p.osm_key === 'highway') return 'Street';
  const n = p.name || '';
  if (/\bTownship\b/i.test(n)) return 'Township';
  if (/\b(County|Parish|Borough)\b/i.test(n)) return 'County';
  return '';
}

function labelOf(p: any, kind: string): string {
  let main = [p.housenumber, p.street].filter(Boolean).join(' ') || p.name || '';
  if (kind === 'County') main = fmtCounty(main);
  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const parts: string[] = [];
  const add = (v?: string) => { if (v && !eq(v, main) && !parts.some((x) => eq(x, v))) parts.push(v); };
  if (p.city) add(p.city);
  else if (p.district) add(p.district);
  if (!p.city && kind !== 'County') add(fmtCounty(p.county));
  add(STATE_ABBR[p.state] || p.state);
  if (p.countrycode && !US_CC.has(p.countrycode.toLowerCase())) add(p.country);
  return [main, ...parts].filter(Boolean).join(', ');
}

async function photonSearch(query: string, count: number, bias?: { lat: number; lon: number }): Promise<GeocodeResult[]> {
  const b = bias ? `&lat=${bias.lat}&lon=${bias.lon}` : '';
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${count + 4}&lang=en${b}`);
  if (!res.ok) throw new Error(`Geocode ${res.status}`);
  const data = await res.json();
  const feats: any[] = data.features ?? [];
  const us = feats.filter((f) => US_CC.has((f.properties?.countrycode || '').toLowerCase()));
  const chosen = us.length ? us : feats;
  const out: GeocodeResult[] = [];
  const seen = new Set<string>();
  for (const f of chosen) {
    const c = f.geometry?.coordinates;
    if (!Array.isArray(c) || c.length < 2) continue;
    const p = f.properties || {};
    const kind = kindOf(p);
    const name = labelOf(p, kind);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, lat: c[1], lon: c[0], kind });
    if (out.length >= count) break;
  }
  return out;
}

async function openMeteoSearch(query: string, count: number): Promise<GeocodeResult[]> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=${count}&language=en&format=json`
  );
  if (!res.ok) throw new Error(`Geocode ${res.status}`);
  const data = await res.json();
  return (data.results ?? []).map((r: any) => ({
    name: [r.name, r.admin1, r.country_code].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
    kind: 'Place',
  }));
}

// Autocomplete: several matches as the user types (Photon, Open-Meteo fallback).
export async function searchPlaces(query: string, count = 6, bias?: { lat: number; lon: number }): Promise<GeocodeResult[]> {
  try {
    const r = await photonSearch(query, count, bias);
    if (r.length) return r;
  } catch {
    /* fall through to Open-Meteo */
  }
  return openMeteoSearch(query, count);
}

// Single best match (used for plain "add by name").
export async function geocode(query: string): Promise<GeocodeResult> {
  const r = (await searchPlaces(query, 1))[0];
  if (!r) throw new Error('No match found');
  return r;
}
