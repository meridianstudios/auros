import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

function star(cx, cy, ro, ri) {
  const p = [];
  for (let i = 0; i < 16; i++) {
    const a = (-90 + i * 22.5) * Math.PI / 180;
    const r = i % 2 === 0 ? ro : ri;
    p.push((cx + r * Math.cos(a)).toFixed(2) + ',' + (cy + r * Math.sin(a)).toFixed(2));
  }
  return p.join(' ');
}

const FONT = 'Segoe UI, Arial, Helvetica, sans-serif';

function card({ eyebrow, title, tagline, footer }) {
  const tx = 96, ty = 232, tile = 162;
  const cx = tx + tile / 2, cy = ty + tile / 2;
  const footerSvg = footer
    ? `<text x="300" y="556" font-family="${FONT}" font-size="22" font-weight="600" fill="#7176a6">${footer}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#191643"/><stop offset="1" stop-color="#0a0a1e"/>
    </linearGradient>
    <radialGradient id="gl" cx="0.82" cy="0" r="0.8">
      <stop offset="0" stop-color="#4a48ff" stop-opacity="0.5"/><stop offset="1" stop-color="#4a48ff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect width="1200" height="630" fill="url(#gl)"/>
  <rect x="${tx}" y="${ty}" width="${tile}" height="${tile}" rx="40" fill="#2d2bf5"/>
  <polygon points="${star(cx, cy, tile * 0.30, tile * 0.123)}" fill="#fff"/>
  <text x="302" y="284" font-family="${FONT}" font-size="26" font-weight="700" letter-spacing="6" fill="#7c83ff">${eyebrow}</text>
  <text x="298" y="380" font-family="${FONT}" font-size="112" font-weight="800" letter-spacing="-3" fill="#ffffff">${title}</text>
  <text x="302" y="440" font-family="${FONT}" font-size="33" font-weight="500" fill="#bcc0d8">${tagline}</text>
  ${footerSvg}
</svg>`;
}

function render(svg, out) {
  mkdirSync(dirname(out), { recursive: true });
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 }, font: { loadSystemFonts: true } });
  writeFileSync(out, r.render().asPng());
  console.log('wrote', out);
}

render(
  card({ eyebrow: 'INDEPENDENT SOFTWARE STUDIO', title: 'meridian', tagline: 'Clean, dependable software, charted.' }),
  'C:/Users/jeffr/Downloads/meridian-site/og.png'
);
render(
  card({ eyebrow: 'SEVERE-WEATHER TRACKING', title: 'Auros', tagline: 'Real-time alerts, live radar, and storm outlooks.', footer: 'by Meridian' }),
  'C:/Users/jeffr/Downloads/nova-weather-pwa/public/og.png'
);
