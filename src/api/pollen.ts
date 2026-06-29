// Daily pollen level for a US location. Data comes from pollen.com via our own
// /api/pollen proxy (pollen.com has no CORS and needs a ZIP + request headers, so
// the proxy reverse-geocodes the coordinates and forwards with the right headers).
// Returns null outside the US or when unavailable — it's additive, never blocking.

const POLLEN_API = 'https://auros.novalabsos.com/api/pollen';

export interface Pollen {
  index: number; // 0–12 scale
  label: string; // Low … High
  triggers: string[]; // top plants in the air, e.g. ["Grass", "Ragweed"]
}

// Pollen index (0–12) → category + color (green → red).
export function pollenInfo(index: number): { label: string; color: string } {
  if (index <= 2.4) return { label: 'Low', color: '#4ADE80' };
  if (index <= 4.8) return { label: 'Low-Med', color: '#A3E635' };
  if (index <= 7.2) return { label: 'Medium', color: '#FBBF24' };
  if (index <= 9.6) return { label: 'Med-High', color: '#FB923C' };
  return { label: 'High', color: '#FB7185' };
}

export async function getPollen(lat: number, lon: number): Promise<Pollen | null> {
  try {
    const res = await fetch(`${POLLEN_API}?lat=${lat}&lon=${lon}`);
    if (!res.ok) return null;
    const d = await res.json();
    if (typeof d.index !== 'number') return null;
    return {
      index: d.index,
      label: pollenInfo(d.index).label,
      triggers: Array.isArray(d.triggers) ? d.triggers.slice(0, 3) : [],
    };
  } catch {
    return null;
  }
}
