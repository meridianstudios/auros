import { Buffer } from 'buffer';

// The NIDS decoder + seek-bzip expect a global Buffer (Node API). Provide it for
// the browser before the decoder runs.
if (typeof (globalThis as { Buffer?: unknown }).Buffer === 'undefined') {
  (globalThis as { Buffer?: unknown }).Buffer = Buffer;
}

export interface L3Radial {
  startAngle: number; // degrees clockwise from true north
  angleDelta: number; // width of this radial in degrees
  bins: (number | null)[]; // physical value per range gate, or null = below threshold
}

export interface L3Data {
  type: string; // e.g. N0G
  code: number; // e.g. 154
  radarLat: number;
  radarLon: number;
  elevationAngle: number;
  gateKm: number; // size of one range gate
  firstBinKm: number;
  radials: L3Radial[];
  scale: { min: number; inc: number; levels: number };
}

// The decoder only ships a few product definitions. The "base data array"
// products (super-res reflectivity/velocity) share reflectivity's product
// description layout, so we register them by cloning code 94's parser. Dual-pol
// (CC/ZDR/KDP) use a different scale encoding and are not added here.
let decoderPromise: Promise<(buf: Buffer, opts: unknown) => unknown> | null = null;

async function getDecoder() {
  if (!decoderPromise) {
    decoderPromise = (async () => {
      const regMod = (await import('nexrad-level-3-data/src/products')) as unknown as {
        default?: { products: Record<string, unknown>; productAbbreviations: string[] };
        products?: Record<string, unknown>;
        productAbbreviations?: string[];
      };
      const reg = (regMod.default ?? regMod) as { products: Record<string, unknown>; productAbbreviations: string[] };
      const tmplMod = (await import('nexrad-level-3-data/src/products/94')) as unknown as {
        default?: { productDescription: unknown };
        productDescription?: unknown;
      };
      const tmpl = (tmplMod.default ?? tmplMod) as { productDescription: { halfwords30_53: unknown } };
      const add = (code: string, abbr: string[], description: string) => {
        if (!reg.products[code]) {
          reg.products[code] = {
            code: Number(code),
            abbreviation: abbr,
            description,
            productDescription: { halfwords30_53: tmpl.productDescription.halfwords30_53 },
          };
          reg.productAbbreviations.push(...abbr);
        }
      };
      add('153', ['N0B', 'N1B', 'N2B', 'N3B'], 'Super-Res Base Reflectivity');
      add('154', ['N0G', 'N1G', 'N2G', 'N3G'], 'Super-Res Base Velocity');

      const mod = (await import('nexrad-level-3-data')) as unknown as {
        default?: (buf: Buffer, opts: unknown) => unknown;
      };
      return (mod.default ?? (mod as unknown)) as (buf: Buffer, opts: unknown) => unknown;
    })();
  }
  return decoderPromise;
}

export async function decodeL3(data: ArrayBuffer): Promise<L3Data> {
  const parse = await getDecoder();
  const r = parse(Buffer.from(data), { logger: false }) as {
    textHeader: { type: string };
    messageHeader: { code: number };
    productDescription: {
      latitude: number; longitude: number; elevationAngle?: number;
      plot?: { minimumDataValue: number; dataIncrement: number; dataLevels: number };
    };
    radialPackets?: Array<{ firstBin: number; numberBins: number; packetCodeHex: string; radials: L3Radial[] }>
      | { firstBin: number; numberBins: number; packetCodeHex: string; radials: L3Radial[] };
  };
  const pd = r.productDescription;
  const layer = Array.isArray(r.radialPackets) ? r.radialPackets[0] : r.radialPackets;
  if (!layer || !layer.radials || !layer.radials.length) throw new Error('No radial data in product');
  // Super-res digital products (packet 0x10) are 0.25 km gates; legacy run-length
  // (af1f) products are 1 km.
  const gateKm = layer.packetCodeHex === 'af1f' ? 1.0 : 0.25;
  return {
    type: r.textHeader.type,
    code: r.messageHeader.code,
    radarLat: pd.latitude,
    radarLon: pd.longitude,
    elevationAngle: pd.elevationAngle ?? 0.5,
    gateKm,
    firstBinKm: (layer.firstBin || 0) * gateKm,
    radials: layer.radials,
    scale: {
      min: pd.plot?.minimumDataValue ?? 0,
      inc: pd.plot?.dataIncrement ?? 1,
      levels: pd.plot?.dataLevels ?? 256,
    },
  };
}
