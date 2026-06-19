// Open-Meteo geocoding — free, no key, CORS-enabled. Used for "search by place".

export interface GeocodeResult {
  name: string;
  lat: number;
  lon: number;
}

export async function geocode(query: string): Promise<GeocodeResult> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`
  );
  if (!res.ok) throw new Error(`Geocode ${res.status}`);
  const data = await res.json();
  const r = data.results?.[0];
  if (!r) throw new Error('No match found');
  const label = [r.name, r.admin1, r.country_code].filter(Boolean).join(', ');
  return { name: label, lat: r.latitude, lon: r.longitude };
}

// Autocomplete: return several matches as the user types.
export async function searchPlaces(query: string, count = 6): Promise<GeocodeResult[]> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=${count}&language=en&format=json`
  );
  if (!res.ok) throw new Error(`Geocode ${res.status}`);
  const data = await res.json();
  return (data.results ?? []).map((r: any) => ({
    name: [r.name, r.admin1, r.country_code].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }));
}
