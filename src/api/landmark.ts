import { useEffect, useState } from 'react';

// Pull a place's lead photo from the Wikipedia REST summary API (free, no key,
// CORS-open) for the Home hero backdrop. Cities resolve to a skyline/landmark
// photo; addresses, townships, and anything without a real photo return null so
// the Home screen keeps its normal gradient hero.

const STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'Washington, D.C.',
};

// Reject location maps, flags, seals, coats of arms, logos, icons, and SVGs — we
// only want actual photographs.
function isPhoto(src: string): boolean {
  return !/location|locator|_map|map_of|\.svg|flag_of|seal_of|coat_of|logo|_icon|emblem/i.test(src);
}

function pickImage(j: { thumbnail?: { source?: string }; originalimage?: { source?: string } }): string | null {
  // Use the original file — it's always served. Arbitrary resized widths are
  // generated on demand and Wikimedia rate-limits them, so they fail
  // intermittently. The cached API thumbnail is a small (~330px) fallback.
  const orig = j.originalimage?.source;
  if (orig && isPhoto(orig)) return orig;
  const thumb = j.thumbnail?.source;
  if (thumb && isPhoto(thumb)) return thumb;
  return null;
}

export async function getLandmarkImage(placeName: string): Promise<string | null> {
  const parts = placeName.split(',').map((s) => s.trim()).filter(Boolean);
  const city = parts[0];
  if (!city || /^\d/.test(city)) return null; // empty, or a street address (starts with a number)
  const stateName = parts.length > 1 ? STATES[parts[parts.length - 1].toUpperCase()] : undefined;

  const titles = stateName ? [`${city}, ${stateName}`, city] : [city];
  for (const title of titles) {
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) continue;
      const j = await res.json();
      if (j.type === 'disambiguation') continue;
      const img = pickImage(j);
      if (img) return img;
    } catch {
      /* try the next title */
    }
  }
  return null;
}

// Derive the full-resolution original from a Wikimedia thumbnail URL (originals
// are always served; on-demand resized widths get rate-limited).
function originalFromThumb(src: string): string {
  const url = src.startsWith('//') ? `https:${src}` : src;
  return url.replace('/thumb/', '/').replace(/\/[^/]+$/, '');
}

const PHOTO_EXT = /\.(jpe?g|png)$/i;

// Up to `max` real photos for a place, from the page's media list (free Wikipedia
// REST API, one request). Used for the Auros Live photo backdrop; [] when the
// place has no usable photos (so Live keeps its plain dark background).
export async function getLandmarkImages(placeName: string, max = 5): Promise<string[]> {
  const parts = placeName.split(',').map((s) => s.trim()).filter(Boolean);
  const city = parts[0];
  if (!city || /^\d/.test(city)) return [];
  const stateName = parts.length > 1 ? STATES[parts[parts.length - 1].toUpperCase()] : undefined;
  const titles = stateName ? [`${city}, ${stateName}`, city] : [city];
  for (const title of titles) {
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(title)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) continue;
      const j = await res.json();
      const items: { type?: string; title?: string; srcset?: { src?: string }[] }[] = Array.isArray(j.items) ? j.items : [];
      const out: string[] = [];
      const seen = new Set<string>();
      for (const it of items) {
        if (it.type !== 'image') continue;
        const t = it.title || '';
        if (!PHOTO_EXT.test(t) || !isPhoto(t)) continue;
        const src = it.srcset?.[0]?.src;
        if (!src) continue;
        const orig = originalFromThumb(src);
        if (!isPhoto(orig) || seen.has(orig)) continue;
        seen.add(orig);
        out.push(orig);
        if (out.length >= max) break;
      }
      if (out.length) return out;
    } catch {
      /* try the next title */
    }
  }
  return [];
}

// Resolve + cache (localStorage) up to a few photos for a place, for the Auros
// Live cycling backdrop. Returns [] while loading / for places without photos.
export function useLandmarkImages(placeName: string): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    setUrls([]);
    if (!placeName) return;
    const key = `auros.lmset.${placeName}`;
    try {
      const cached = localStorage.getItem(key);
      if (cached !== null) { setUrls(cached ? JSON.parse(cached) : []); return; }
    } catch { /* ignore */ }
    getLandmarkImages(placeName)
      .then((list) => {
        if (!active) return;
        try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* ignore */ }
        setUrls(list);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [placeName]);
  return urls;
}

// Resolve + cache (localStorage) the hero image for a place. Returns null while
// loading and for places without a usable photo.
export function useLandmark(placeName: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setUrl(null);
    if (!placeName) return;
    const key = `auros.lm2.${placeName}`; // v2: stores the original-image URL
    try {
      const cached = localStorage.getItem(key);
      if (cached !== null) { setUrl(cached || null); return; }
    } catch { /* ignore */ }
    getLandmarkImage(placeName)
      .then((u) => {
        if (!active) return;
        if (!u) { try { localStorage.setItem(key, ''); } catch { /* ignore */ } return; }
        // Preload so we only swap the hero in once the image is actually ready
        // (no dark flash); a transient load failure just keeps the gradient hero.
        const img = new Image();
        img.onload = () => { if (!active) return; try { localStorage.setItem(key, u); } catch { /* ignore */ } setUrl(u); };
        img.onerror = () => { /* leave uncached so it retries next time */ };
        img.src = u;
      })
      .catch(() => {});
    return () => { active = false; };
  }, [placeName]);
  return url;
}
