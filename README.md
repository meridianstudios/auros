<div align="center">

<img src="src-tauri/icons/icon.png" alt="Auros" width="96" />

# Auros

**Severe weather, clarified.** Real-time alerts, pro-grade radar, and the context to know when something is actually coming.

[Open the web app](https://auros.novalabsos.com) · [Download](https://github.com/meridianstudios/auros/releases/latest) · [About](https://meridian.novalabsos.com/auros.html)

</div>

Auros is a free severe-weather app. It reads straight from the source (the National Weather Service, the Storm Prediction Center, the National Hurricane Center, and raw NEXRAD radar) and shows it in a fast, calm app you can install. No ads, no upsells, no account required to start.

The part that makes it different: Auros decodes single-site **NEXRAD Level 3** radar (velocity, dual-polarization, and more) right in your browser and on your phone. On mobile that usually means paying for an app like RadarScope or RadarOmega. Here it is free, on every platform, the web included.

It is built to sit alongside a NOAA weather radio, not replace it. The moment a warning is issued it takes over the screen and sounds an attention tone. The rest of the time it stays quiet.

## Download

Pick your platform from the [latest release](https://github.com/meridianstudios/auros/releases/latest), or skip the install and open [auros.novalabsos.com](https://auros.novalabsos.com) in any browser.

| Platform | File |
| --- | --- |
| Windows 10 / 11 | `Auros_*_x64-setup.exe` (or the `.msi`) |
| macOS (Apple Silicon) | `Auros_*_aarch64.dmg` |
| macOS (Intel) | `Auros_*_x64.dmg` |
| Linux | `Auros_*_amd64.AppImage`, `.deb`, or `.rpm` |
| Android | `auros.apk` (sideload) |
| Any browser | [auros.novalabsos.com](https://auros.novalabsos.com) |

The installers are not code-signed yet, so your OS may warn you once. On Windows choose "More info" then "Run anyway"; on macOS right-click the app and choose "Open."

## What it does

- **Alerts the moment they post.** Live NWS watches and warnings for every place you save, with a full-screen takeover and an EAS-style attention tone when a tornado or severe warning is issued. Quiet hours and per-event filters keep the noise down, and tornado warnings always come through.
- **Real NEXRAD Level 3 radar.** Base and storm-relative velocity, correlation coefficient, differential reflectivity (ZDR), specific differential phase (KDP), hydrometeor classification, multiple elevation tilts, and a time loop. The national reflectivity mosaic and live warning polygons are there too.
- **Storm outlooks.** SPC categorical risk for Days 1 through 3, color-coded on the home screen.
- **Tropical tracking.** Active systems from the National Hurricane Center with the forecast cone, track, category, winds, and distance from you, drawn on the radar.
- **A weather-radio finder.** Every NWS transmitter in the country, ranked by the signal you will actually receive rather than raw distance, so you know the best channel for your spot.
- **Optional accounts.** Sign in with email or Google to sync your saved locations and settings across devices, or skip it and run fully local.

## Screenshots

See it live at [auros.novalabsos.com](https://auros.novalabsos.com).

<!-- Drop three shots into docs/screenshots/ (see the guide there), then uncomment:
<div align="center">
<img src="docs/screenshots/home.png" alt="Home screen with live conditions and alerts" width="30%" />
<img src="docs/screenshots/radar.png" alt="NEXRAD Level 3 velocity radar" width="30%" />
<img src="docs/screenshots/forecast.png" alt="Hourly forecast graph" width="30%" />
</div>
-->


## How the radar works

The Level 3 products are the interesting part, because there is no server behind them.

NOAA publishes the raw Level 3 radar archive to a public AWS bucket (`unidata-nexrad-level3`) that allows cross-origin reads. Auros fetches the latest scan for a site straight from that bucket, decodes the WSR-88D binary in JavaScript on the device, and projects the polar radials onto the map with a canvas layer. Velocity, dual-pol, tilts, and animation all happen client-side. Nothing is precomputed and nothing is proxied.

That is why the same features run on the web, on desktop, and on Android from one codebase. The native builds simply decode a little faster.

## Built with

- React 19, TypeScript, and Vite, shipped as an installable PWA
- Tauri 2 for the desktop builds and Capacitor for the Android APK
- Leaflet for the map, with a custom canvas layer for the L3 radials
- `nexrad-level-3-data` for the radar decode
- Firebase for optional auth and Firestore sync
- Free, public data only: `api.weather.gov`, the SPC and NHC feeds, IEM radar tiles, Open-Meteo, and the NOAA Level 3 bucket

## Run it yourself

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # typecheck + production build
npm run preview   # serve the production build
```

Desktop and mobile builds:

```bash
npm run tauri build         # current desktop platform
npx cap sync android        # then build the APK with Gradle
```

CI builds every platform automatically. Push a `vX.Y.Z` tag and GitHub Actions produces the Windows, macOS, Linux, and Android artifacts on a draft release.

## Accounts (optional)

Copy `.env.example` to `.env` and add your Firebase web config to turn on sign-in and cloud sync. With no config the app runs fully local and nothing breaks.

## A note on safety

Auros is for situational awareness. It does not replace a NOAA weather radio or the Wireless Emergency Alerts built into your phone, and it is not affiliated with the National Weather Service. When the official sources and Auros disagree, trust the official sources. Always have more than one way to receive a warning.

## Contributing

Bug reports, ideas, and pull requests are welcome. If you found a problem during real weather, a screenshot and the radar site or your location helps a lot.

## License

MIT. See [LICENSE](LICENSE).

Auros is a [Meridian](https://meridian.novalabsos.com) project.
