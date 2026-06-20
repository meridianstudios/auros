// Generate Meridian-themed NSIS installer images (BMP) from SVG via resvg.
// header.bmp = 150x57 (top strip), sidebar.bmp = 164x314 (welcome/finish panel).
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';

const BOLT = 'M288 70 L168 288 L242 288 L214 442 L352 246 L272 246 Z';

const header = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="57">
  <rect width="150" height="57" fill="#ffffff"/>
  <g transform="translate(10,9.5) scale(0.074)">
    <rect width="512" height="512" rx="116" fill="#0B1020"/>
    <g fill="none" stroke="#22D3EE" stroke-opacity="0.18" stroke-width="10"><circle cx="256" cy="256" r="120"/><circle cx="256" cy="256" r="196"/></g>
    <path d="${BOLT}" fill="#6E8BFF"/>
  </g>
  <text x="60" y="32" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="700" fill="#0B1020">Auros</text>
  <text x="61" y="45" font-family="Segoe UI, Arial, sans-serif" font-size="9" fill="#6B7180">by Meridian</text>
</svg>`;

const sidebar = `<svg xmlns="http://www.w3.org/2000/svg" width="164" height="314">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#0B1020"/><stop offset="0.65" stop-color="#23286b"/><stop offset="1" stop-color="#2d2bf5"/>
    </linearGradient>
    <linearGradient id="bolt" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#BFCBFF"/><stop offset="1" stop-color="#6E8BFF"/>
    </linearGradient>
  </defs>
  <rect width="164" height="314" fill="url(#g)"/>
  <g transform="translate(82,118)">
    <g fill="none" stroke="#22D3EE" stroke-opacity="0.28" stroke-width="2"><circle r="34"/><circle r="58"/><circle r="80"/></g>
    <g transform="scale(0.17) translate(-260,-256)"><path d="${BOLT}" fill="url(#bolt)"/></g>
  </g>
  <text x="82" y="234" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="27" font-weight="800" fill="#ffffff" letter-spacing="-0.5">Auros</text>
  <text x="82" y="254" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#A9B8FF">by Meridian</text>
  <g transform="translate(82,288)"><polygon points="0,-9 1.7,-2.6 8,-4.2 3.4,0 8,4.2 1.7,2.6 0,9 -1.7,2.6 -8,4.2 -3.4,0 -8,-4.2 -1.7,-2.6" fill="#ffffff" opacity="0.8"/></g>
</svg>`;

function bmp24(svg, w, h) {
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: w }, font: { loadSystemFonts: true } }).render();
  const px = img.pixels; // RGBA, top-to-bottom
  const rowSize = Math.floor((24 * w + 31) / 32) * 4;
  const buf = Buffer.alloc(54 + rowSize * h);
  buf.write('BM', 0);
  buf.writeUInt32LE(buf.length, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(w, 18);
  buf.writeInt32LE(h, 22); // positive = bottom-up
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(rowSize * h, 34);
  let off = 54;
  for (let y = h - 1; y >= 0; y--) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      buf[off++] = px[i + 2]; buf[off++] = px[i + 1]; buf[off++] = px[i]; // BGR
    }
    off += rowSize - w * 3;
  }
  return buf;
}

mkdirSync('src-tauri/installer', { recursive: true });
writeFileSync('src-tauri/installer/header.bmp', bmp24(header, 150, 57));
writeFileSync('src-tauri/installer/sidebar.bmp', bmp24(sidebar, 164, 314));
console.log('wrote header.bmp + sidebar.bmp');
console.log('icon.ico present:', existsSync('src-tauri/icons/icon.ico'));
