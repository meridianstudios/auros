# Auros Live background music

Drop your instrumental tracks (`.mp3` or `.wav`) into this folder, then list their
filenames in `tracks.json`, for example:

```json
["auros-live-01.mp3", "auros-live-02.mp3", "auros-live-03.wav"]
```

Auros Live fetches `tracks.json`, shuffles the list, and plays them back to back on
a loop. If the list is empty the mode just runs silently (no music), so it works
fine before any tracks are added.

Tips:
- Keep them instrumental and calm so the alert break-ins stand out.
- The player ducks the volume automatically while a warning is active.
