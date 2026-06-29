// Serverless proxy for pollen.com's daily pollen forecast.
//
// pollen.com is keyed by ZIP, sends no CORS header, and 403s without browser-like
// request headers, so it can't be called from the client. This function reverse-
// geocodes the coordinates to a US ZIP, calls pollen.com with the right headers,
// and returns today's index + the active trigger plants with an open CORS header.
// US only; returns {} when there's no data so the client can quietly skip it.

// US Census ZCTA (ZIP) for the coordinates — reliable everywhere in the US, no
// key or rate limits, doesn't depend on OSM having a postcode mapped.
async function zipViaCensus(lat, lon) {
  try {
    const r = await fetch(
      'https://geocoding.geo.census.gov/geocoder/geographies/coordinates' +
        `?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json&layers=all`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return null;
    const groups = (await r.json())?.result?.geographies || {};
    for (const k of Object.keys(groups)) {
      const arr = groups[k];
      if (Array.isArray(arr)) {
        for (const it of arr) {
          if (it && it.ZCTA5) return String(it.ZCTA5).split('-')[0];
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Fallback: OSM reverse geocode (needs a detailed zoom to surface the postcode).
async function zipViaNominatim(lat, lon) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=18&addressdetails=1`,
      { headers: { 'User-Agent': 'AurosWeather/1.0 (https://auros.novalabsos.com)' }, signal: AbortSignal.timeout(7000) }
    );
    if (!r.ok) return null;
    const pc = (await r.json())?.address?.postcode;
    return pc ? String(pc).split('-')[0].trim() : null;
  } catch {
    return null;
  }
}

async function zipFor(lat, lon) {
  return (await zipViaCensus(lat, lon)) || (await zipViaNominatim(lat, lon));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  const lat = parseFloat(req.query?.lat);
  const lon = parseFloat(req.query?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.status(200).json({});
    return;
  }

  try {
    const zip = await zipFor(lat, lon);
    if (!zip) {
      res.status(200).json({});
      return;
    }
    const pr = await fetch(`https://www.pollen.com/api/forecast/current/pollen/${zip}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (AurosWeather)',
        Referer: `https://www.pollen.com/forecast/current/pollen/${zip}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!pr.ok) {
      res.status(200).json({});
      return;
    }
    const data = await pr.json();
    const periods = data?.Location?.periods ?? [];
    const today = periods.find((p) => p.Type === 'Today') ?? periods[1] ?? periods[0];
    if (!today || typeof today.Index !== 'number') {
      res.status(200).json({});
      return;
    }
    const triggers = [
      ...new Set((today.Triggers ?? []).map((t) => t.PlantType || t.Name).filter(Boolean)),
    ].slice(0, 3);
    res.status(200).json({ index: today.Index, triggers, city: data?.Location?.DisplayLocation || '' });
  } catch {
    res.status(200).json({});
  }
}
