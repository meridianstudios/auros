// Serverless proxy for the U.S. Census Bureau geocoder.
//
// The Census geocoder has excellent street-address coverage (it interpolates
// house numbers along TIGER street ranges, so it finds homes that OpenStreetMap
// has never mapped). The catch: it sends no CORS header, so a browser or WebView
// can't call it directly. This function calls it server-side and re-emits the
// result with an open CORS header, so both the web app and the native apps can
// use it through a plain fetch.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400');

  const q = (req.query?.q || '').toString().trim();
  if (!q) {
    res.status(200).json({ matches: [] });
    return;
  }

  try {
    const url =
      'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress' +
      `?address=${encodeURIComponent(q)}&benchmark=Public_AR_Current&format=json`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) {
      res.status(200).json({ matches: [] });
      return;
    }
    const data = await r.json();
    const matches = (data?.result?.addressMatches || [])
      .slice(0, 4)
      .map((m) => ({
        address: m.matchedAddress, // e.g. "380 MARSHALL ST, COLDWATER, MI, 49036"
        lat: m.coordinates?.y,
        lon: m.coordinates?.x,
      }))
      .filter((m) => typeof m.lat === 'number' && typeof m.lon === 'number');
    res.status(200).json({ matches });
  } catch {
    res.status(200).json({ matches: [] });
  }
}
