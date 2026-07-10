# Auros Live — Frutiger Aero weather icons

Drop your glossy weather icons here as **individual PNGs with transparent
backgrounds** (one icon per file, roughly square, icon centered). Auros Live's
Frutiger Aero style will use them in place of the built-in SVG icons; any
condition you don't provide falls back to the SVG automatically.

Use these exact filenames (only the ones you have — the rest fall back):

| File | Condition |
|------|-----------|
| `sun.png` | Clear / sunny (day) |
| `moon.png` | Clear (night) |
| `pcloudy-day.png` | Partly / mostly cloudy (day) — sun behind cloud |
| `pcloudy-night.png` | Partly / mostly cloudy (night) — moon behind cloud |
| `cloudy.png` | Cloudy / overcast |
| `rain.png` | Rain / showers |
| `drizzle.png` | Drizzle (optional — falls back to rain look) |
| `tstorm.png` | Thunderstorms |
| `snow.png` | Snow / wintry (optional) |
| `fog.png` | Fog / haze (optional) |

Notes:
- Transparent background is important — these sit on light glossy panels.
- Square-ish with the icon centered and a little padding works best.
- After adding them, tell Claude and the image-based icon set gets wired in
  (with SVG fallback for anything missing). No filename = SVG is used.
