// Broadcast narration for Auros Live. Uses the platform's built-in speech
// synthesis (Web Speech API): clean-licensed, free, offline, and available on the
// web, the Tauri desktop webview, and Android WebView. Only the era looks narrate:
// Weatherscan (whose real "Vocal Local" was Amy Bargeron, a natural female voice)
// biases to a female voice; Frutiger Aero (TWC IntelliStar era, male voiceover)
// biases male. Both at NATURAL pitch — the real broadcasts were clear human
// voices, never low/robotic. One line at a time; a new speak() cancels the prior.
//
// (The genuinely iconic DECtalk/SAM robotic voices were ruled out for shipping:
// the MIT DECtalk WASM is a pthreads build that needs cross-origin isolation,
// which breaks the app's cross-origin radar tiles + images; SAM is unlicensed
// abandonware. This stays clean and cross-platform.)

export interface VoiceProfile { rate?: number; pitch?: number; gender?: 'female' | 'male' }

let token = 0; // bumps on every speak()/stopSpeaking() so stale async work bails

// Tidy text for the synthesizer: spell out symbols/units that show fine on screen
// but read badly aloud.
function forSpeech(s: string): string {
  return s
    .replace(/°/g, ' degrees')
    .replace(/%/g, ' percent')
    .replace(/\bmph\b/gi, 'miles per hour')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stopSpeaking(): void {
  token++;
  if (typeof speechSynthesis !== 'undefined') { try { speechSynthesis.cancel(); } catch { /* noop */ } }
}

// Web Speech exposes no gender field, so guess from known voice names.
const FEMALE_RE = /\b(samantha|aria|jenny|michelle|ava|allison|susan|zira|karen|moira|tessa|serena|fiona|catherine|linda|heather|hazel|clara|emma|nova|female)\b|google us english/i;
const MALE_RE = /\b(guy|davis|andrew|david|mark|alex|daniel|fred|tom|aaron|arthur|james|george|ryan|eric|brandon|christopher|male)\b/i;
// Neural/online voices sound dramatically better than the legacy "Desktop" ones.
const NATURAL_RE = /natural|neural|online|premium|enhanced|google|siri/i;

function pickVoice(gender?: 'female' | 'male'): SpeechSynthesisVoice | undefined {
  const vs = speechSynthesis.getVoices().filter((v) => /^en(-|_|$)/i.test(v.lang));
  if (!vs.length) return undefined;
  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    if (/en[-_]us/i.test(v.lang)) s += 3;              // US English first
    if (NATURAL_RE.test(v.name)) s += 5;               // prefer neural/natural quality
    if (/desktop/i.test(v.name)) s -= 3;               // avoid clunky legacy voices
    if (gender && (gender === 'female' ? FEMALE_RE : MALE_RE).test(v.name)) s += 4;
    if (gender && (gender === 'female' ? MALE_RE : FEMALE_RE).test(v.name)) s -= 2;
    return s;
  };
  return [...vs].sort((a, b) => score(b) - score(a))[0];
}

// Some browsers populate the voice list asynchronously on first use.
function voicesReady(): Promise<void> {
  return new Promise((resolve) => {
    if (speechSynthesis.getVoices().length) { resolve(); return; }
    const t = setTimeout(resolve, 700);
    speechSynthesis.addEventListener('voiceschanged', () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

// Speak one line. Resolves when the line finishes (or is cancelled/unsupported).
export async function speak(text: string, profile: VoiceProfile = {}): Promise<void> {
  const clean = forSpeech(text);
  stopSpeaking();
  const mine = token; // captured after stopSpeaking() bumped it
  if (!clean || typeof speechSynthesis === 'undefined') return;
  await voicesReady();
  if (mine !== token) return;
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(clean);
    const v = pickVoice(profile.gender);
    if (v) u.voice = v;
    u.rate = profile.rate ?? 1;
    u.pitch = profile.pitch ?? 1;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}
