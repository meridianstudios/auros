// EAS-style attention tone, synthesized locally with the Web Audio API (the
// recognizable two-tone 853 + 960 Hz signal). This is a personal alert sound for
// the app's own user — not a broadcast — and contains none of the SAME/EAS
// digital header codes.

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

// Browsers won't play audio until the user has interacted with the page. Resume
// the context on the first gesture so a later alert can sound without one.
export function initAudioUnlock(): void {
  if (typeof document === 'undefined') return;
  const unlock = () => {
    const c = audioCtx();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
  };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
}

// Play the two-tone attention signal for durationSec. Returns a stop fn (used to
// silence it when the alarm is dismissed).
export function playEasAttention(durationSec = 8): () => void {
  const c = audioCtx();
  if (!c) return () => {};
  if (c.state === 'suspended') c.resume().catch(() => {});

  const gain = c.createGain();
  const now = c.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.06); // fade in
  gain.connect(c.destination);

  const make = (freq: number) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    o.connect(gain);
    return o;
  };
  const o1 = make(853);
  const o2 = make(960);
  const end = now + durationSec;
  o1.start(now); o2.start(now);
  gain.gain.setValueAtTime(0.18, end - 0.12);
  gain.gain.exponentialRampToValueAtTime(0.0001, end); // fade out
  o1.stop(end); o2.stop(end);

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    try {
      const t = c.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      o1.stop(t + 0.1); o2.stop(t + 0.1);
    } catch { /* already stopped */ }
  };
}
