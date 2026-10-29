"use client";

import { ringBuzz } from "@/lib/ui/feedback";

/** Loud enough for a pocket, soft enough not to clip a phone speaker. */
const RING_GAIN = 0.3;

/**
 * THE RING, while an incoming call screen is open. No audio file: a two tone
 * ring drawn with Web Audio every three seconds, so nothing is downloaded for
 * a call that may never come.
 *
 * AUDIBLE, AND ALLOWED (27 October 2026, founder: "calls do not ring"). The
 * tones were drawn at a gain of 0.06, which on a phone speaker is barely
 * there, and the audio context was made with no tap behind it, which Safari,
 * WKWebView and Chrome all leave suspended. The tones are now at a level a
 * pocket can hear, and the first touch, click or key while the screen rings
 * resumes the context, so a person who reaches for the phone hears it at once
 * even where the page could not start sound by itself.
 *
 * Silent means silent. Where the browser exposes the audio session (Safari
 * and WKWebView, `navigator.audioSession`), the ring is declared "ambient",
 * which is the category the iPhone's ring/silent switch mutes. Elsewhere the
 * page plays at the media volume the person set. A browser that blocks
 * audio until a tap simply rings without sound: the screen is the ring.
 *
 * Vibration where the device has it (Android), through `lib/ui/feedback.ts`
 * like every other buzz, and not under reduced motion, which asks for less
 * sensory movement, a buzz included. The visual pulse round the avatar
 * follows the same setting in CSS.
 */
export function startRing(opts: { sound?: boolean; vibrate?: boolean } = {}): () => void {
  if (typeof window === "undefined") return () => {};
  let stopped = false;
  let ctx: AudioContext | null = null;

  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  const previousType = session?.type;
  try {
    if (session) session.type = "ambient";
  } catch {
    /* Read-only on some builds. */
  }

  const tone = (at: number, freq: number) => {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(RING_GAIN, at + 0.04);
    gain.gain.setValueAtTime(RING_GAIN, at + 0.36);
    gain.gain.linearRampToValueAtTime(0, at + 0.42);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.45);
  };

  const ring = () => {
    if (stopped) return;
    if (opts.sound !== false) {
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AC) {
          ctx ??= new AC();
          void ctx.resume().catch(() => undefined);
          const t = ctx.currentTime + 0.02;
          tone(t, 660);
          tone(t + 0.5, 880);
        }
      } catch {
        /* No audio on this device: the screen is the ring. */
      }
    }
    if (opts.vibrate !== false) ringBuzz(true);
  };

  ring();
  const timer = window.setInterval(ring, 3000);
  /* The first touch resumes a context the page could not start by itself. */
  const events = ["pointerdown", "touchend", "keydown"] as const;
  const resume = () => {
    void ctx?.resume().catch(() => undefined);
    for (const name of events) document.removeEventListener(name, resume, true);
  };
  for (const name of events) document.addEventListener(name, resume, { capture: true, passive: true } as AddEventListenerOptions);
  return () => {
    stopped = true;
    for (const name of events) document.removeEventListener(name, resume, true);
    window.clearInterval(timer);
    ringBuzz(false);
    /* Ambient cannot record: hand the session back so the mic can open. */
    try {
      if (session && previousType !== undefined) session.type = previousType === "ambient" ? "auto" : previousType;
    } catch {
      /* Read-only on some builds. */
    }
    void ctx?.close().catch(() => undefined);
    ctx = null;
  };
}
