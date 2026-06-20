// Fetch the latest NEXRAD Level 3 product file for a site directly from the
// public, CORS-open Unidata AWS bucket. Keys are
//   <SITE3>_<PROD>_<YYYY>_<MM>_<DD>_<HH>_<MM>_<SS>
// and sort lexicographically == chronologically, so the last key is newest.
import { bucketSite } from '../data/nexradSites';

const BUCKET = 'https://unidata-nexrad-level3.s3.amazonaws.com';

const pad = (n: number) => String(n).padStart(2, '0');

async function listKeys(prefix: string, startAfter?: string): Promise<string[]> {
  const u = new URL(`${BUCKET}/`);
  u.searchParams.set('list-type', '2');
  u.searchParams.set('prefix', prefix);
  u.searchParams.set('max-keys', '1000');
  if (startAfter) u.searchParams.set('start-after', startAfter);
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error(`Radar bucket list failed: ${res.status}`);
  const xml = await res.text();
  const keys: string[] = [];
  const re = /<Key>([^<]+)<\/Key>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) keys.push(m[1]);
  return keys;
}

export interface L3Fetch {
  data: ArrayBuffer;
  key: string;
  /** scan time parsed from the key (UTC) */
  time: Date;
}

function timeFromKey(key: string): Date {
  // SITE_PROD_YYYY_MM_DD_HH_MM_SS
  const p = key.split('_');
  const [, , Y, M, D, h, m, s] = p;
  return new Date(Date.UTC(+Y, +M - 1, +D, +h, +m, +s));
}

// Most recent keys for siteId + product, newest last. Tries today then
// yesterday (UTC); start-after jumps near "now" so high-volume products don't
// get truncated to an old page.
async function recentKeys(siteId: string, prod: string, count: number): Promise<string[]> {
  const site3 = bucketSite(siteId);
  const now = new Date();
  for (const dayOffset of [0, 1]) {
    const d = new Date(now.getTime() - dayOffset * 86_400_000);
    const Y = d.getUTCFullYear();
    const datePrefix = `${site3}_${prod}_${Y}_${pad(d.getUTCMonth() + 1)}_${pad(d.getUTCDate())}`;
    let startAfter: string | undefined;
    if (dayOffset === 0) startAfter = `${datePrefix}_${pad(Math.max(0, d.getUTCHours() - 4))}`;
    let keys = await listKeys(datePrefix, startAfter);
    if (!keys.length && startAfter) keys = await listKeys(datePrefix);
    if (keys.length) return keys.slice(-count);
  }
  return [];
}

export async function fetchLatestL3(siteId: string, prod: string): Promise<L3Fetch | null> {
  const keys = await recentKeys(siteId, prod, 1);
  if (!keys.length) return null;
  const key = keys[0];
  const res = await fetch(`${BUCKET}/${key}`);
  if (!res.ok) throw new Error(`Radar file fetch failed: ${res.status}`);
  return { data: await res.arrayBuffer(), key, time: timeFromKey(key) };
}

// The last `count` scans (oldest → newest) for the animation loop.
export async function fetchRecentL3(siteId: string, prod: string, count: number): Promise<L3Fetch[]> {
  const keys = await recentKeys(siteId, prod, count);
  const out = await Promise.all(
    keys.map(async (key) => {
      const res = await fetch(`${BUCKET}/${key}`);
      if (!res.ok) return null;
      return { data: await res.arrayBuffer(), key, time: timeFromKey(key) };
    })
  );
  return out.filter((r): r is L3Fetch => r !== null);
}
