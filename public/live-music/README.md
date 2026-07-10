# Auros Live background music

Drop your instrumental tracks (`.mp3` recommended, `.wav` also works) into this
folder, then list their exact filenames in `tracks.json`:

```json
["Auros Live 1.mp3", "Auros Live 2.mp3", "Auros Live 3.mp3"]
```

The current list is `Auros Live 1.mp3` … `Auros Live 22.mp3`.

## How playback works

Auros Live fetches `tracks.json` and treats it as a pool, not a fixed order:

- **Randomized, not sequential.** Each track is chosen at random.
- **No-repeat cooldown.** A track won't play again until several others have (up
  to 8, or fewer if the pool is smaller), so you don't hear the same tune twice
  in a short span — the way Weatherscan rotates its library.
- **Lazy, low-memory.** Only the playing track is loaded. The next one is
  preloaded in the final ~12 seconds so it starts with no gap, so at most two
  files sit in memory at once. Nothing else is downloaded up front, keeping the
  app light.
- **Self-healing.** If a file is missing or won't decode, it's skipped instead of
  stalling the rotation.

If `tracks.json` is empty the mode just runs silently — no music, no errors.

## Where the audio lives (streaming, not bundled)

To keep the desktop and Android installers small, the `.mp3` files are **not**
shipped inside the native apps. The build strips them from the native bundles
(`npm run build:native` → `scripts/strip-live-music.mjs`); only `tracks.json`
stays. The native apps stream each track from the deployed web host
(`auros.novalabsos.com/live-music/`) and cache it on-device via the Cache API, so
a track downloads at most once and the user can wipe the lot from
Settings → Auros Live → Downloaded music.

The plain web build (`npm run build`, used by Vercel) keeps the audio and serves
it same-origin. `vercel.json` adds an `Access-Control-Allow-Origin` header on
`/live-music/*` so the native apps can fetch it cross-origin.

**Important:** because native streams from the deployed site, new tracks only play
on the native apps once they've been committed and the web app has been deployed.
On web/dev they play straight from this folder.

## Adding more later

Filenames don't have to follow the `Auros Live N` pattern — any name works
(e.g. a Soundtrap export). Just drop the file here and add its exact filename to
`tracks.json`. No code changes needed.

## Tips

- Keep them instrumental and calm so the alert break-ins stand out.
- The player ducks the volume automatically while a warning is active.
- Trim any big final chord or fade so tracks end evenly — the rotation sounds
  more seamless that way.
