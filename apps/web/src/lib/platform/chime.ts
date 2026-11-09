/**
 * THE IN-APP CHIME (FEATURE_BACKLOG A10, founder, 7 November 2026). When
 * something arrives while Vallo is open (a message in another thread, a
 * booking answered), a softer echo of the push's own two notes (A5 then E6),
 * drawn with Web Audio, so there is no file to fetch.
 *
 * QUIET BY RULE:
 *   - the iPhone's ring/silent switch: Web Audio follows it (the session is
 *     set to `ambient` where the browser lets a page say so), so a phone on
 *     silent stays silent;
 *   - only while the page is on screen, never twice inside `MIN_GAP_MS`;
 *   - never before the person has touched the page (browsers refuse sound
 *     until then, and a suspended context is simply skipped);
 *   - a per-device off switch (`setChimeOn(false)`), for a Settings row.
 *
 * Nothing here is wired to an event yet: the caller (the unread counter or
 * the banner) decides what deserves a chime.
 */
const KEY = "vallo.chime";
export const MIN_GAP_MS = 3000;
const NOTES: ReadonlyArray<{ freq: number; at: number; gain: number }> = [
  { freq: 880, at: 0, gain: 0.16 },
  { freq: 1318.5, at: 0.11, gain: 0.14 },
];

let context: AudioContext | null = null;
let lastAt = 0;

export function chimeOn(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setChimeOn(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* Storage refused: the chime keeps its default. */
  }
}

/** Whether a chime would sound now (pure parts of the rule, for the caller and the tests). */
export function chimeAllowed(input: { on: boolean; visible: boolean; now: number; last: number }): boolean {
  return input.on && input.visible && input.now - input.last >= MIN_GAP_MS;
}

/** Play the chime if every rule allows it. Never throws; returns whether it played. */
export function playInAppChime(now: number = Date.now()): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (!chimeAllowed({ on: chimeOn(), visible: document.visibilityState === "visible", now, last: lastAt })) return false;
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "ambient";
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    context ??= new Ctor();
    if (context.state !== "running") {
      void context.resume().catch(() => undefined);
      return false;
    }
    lastAt = now;
    const t0 = context.currentTime + 0.01;
    for (const note of NOTES) {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "sine";
      osc.frequency.value = note.freq;
      const start = t0 + note.at;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(note.gain, start + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
      osc.connect(gain).connect(context.destination);
      osc.start(start);
      osc.stop(start + 0.6);
    }
    return true;
  } catch {
    return false;
  }
}
