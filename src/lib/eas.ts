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
// silence it when the alarm is dismissed). If the context is suspended (e.g. no
// user gesture yet) the tone starts only once it actually resumes, scheduled
// against a fresh clock — never against the frozen suspended time, which used to
// make the tone fire late and out of sync.
export function playEasAttention(durationSec = 8): () => void {
  const c = audioCtx();
  if (!c) return () => {};

  let stopped = false;
  let stopImpl: (() => void) | null = null;

  const run = () => {
    if (stopped || c.state !== 'running') return;
    const gain = c.createGain();
    const now = c.currentTime; // fresh — the context is running now
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

    stopImpl = () => {
      try {
        const t = c.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        o1.stop(t + 0.1); o2.stop(t + 0.1);
      } catch { /* already stopped */ }
    };
  };

  if (c.state === 'suspended') c.resume().then(run).catch(() => {});
  else run();

  return () => {
    stopped = true;
    stopImpl?.();
  };
}

// Weatherscan-style alert cue: three quick synth beeps — a square wave softened
// by a lowpass so it reads "calm but slightly distorted" rather than harsh.
// Fire-and-forget (short), used when an alert pops up in Auros Live.
export function playAlertBeeps(): void {
  const c = audioCtx();
  if (!c) return;
  const run = () => {
    if (c.state !== 'running') return;
    const t0 = c.currentTime + 0.02;
    const beep = (start: number) => {
      const o = c.createOscillator();
      o.type = 'square';
      o.frequency.value = 988; // calm mid tone (B5)
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2300; // tame the square's harshness → soft, slightly distorted
      const g = c.createGain();
      o.connect(lp); lp.connect(g); g.connect(c.destination);
      const dur = 0.12;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.16, start + 0.012);
      g.gain.setValueAtTime(0.16, start + dur - 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.start(start); o.stop(start + dur + 0.02);
    };
    beep(t0); beep(t0 + 0.2); beep(t0 + 0.4);
  };
  if (c.state === 'suspended') c.resume().then(run).catch(() => {});
  else run();
}
