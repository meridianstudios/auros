# Auros

Personal severe-weather PWA — real-time National Weather Service alerts, SPC storm-risk outlook, an approaching-storm timeline, and animated radar. Fast, installable, and built to complement (not replace) a NOAA weather radio.

A **Meridian** project.

## Stack

- **React 19 + TypeScript + Vite** — installable PWA via `vite-plugin-pwa`
- **Leaflet** — IEM NEXRAD radar tiles + Esri basemap, with warning polygons
- **Firebase** — Auth (email + Google) + Firestore cloud sync of saved locations & prefs *(optional)*
- **Data sources** — NWS `api.weather.gov`, SPC categorical outlook, Open-Meteo geocoding (all free / public)

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck (tsc) + production build
npm run preview  # serve the production build locally
```

## Accounts (optional)

Copy `.env.example` → `.env` and fill in your Firebase web config to enable sign-in + cloud sync. With no config, the app runs fully local (no accounts) — nothing breaks.

## Deploy

Hosted on Vercel. Pushes to `main` auto-deploy.
