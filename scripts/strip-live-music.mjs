// Remove the Auros Live audio files from a built `dist/` so the native app
// bundles (Tauri installer, Android APK/AAB) don't carry ~90 MB of music.
// `tracks.json` is kept so the app still knows the playlist; the audio itself is
// streamed from the deployed web host and cached on-device on demand.
//
// Run after `vite build` for native builds only (see the `build:native` script).
// The web deploy uses a plain `vite build`, so it keeps the audio and serves it.
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const dir = 'dist/live-music';
const AUDIO = /\.(mp3|wav|ogg|m4a)$/i;

try {
  const files = await readdir(dir);
  let removed = 0;
  let bytesNote = '';
  for (const f of files) {
    if (AUDIO.test(f)) {
      await rm(join(dir, f));
      removed++;
    }
  }
  console.log(`strip-live-music: removed ${removed} audio file(s) from ${dir} (tracks.json kept)${bytesNote}`);
} catch (err) {
  // No folder / nothing to strip is fine (e.g. audio already absent).
  console.log(`strip-live-music: nothing to strip (${err.code || err.message})`);
}
