/**
 * RECORDING A VOICE NOTE: THE PURE PIECES (Platform Grade 1, P1.3).
 *
 * The composer's hold-to-record lives in `useVoiceRecorder` and
 * `ComposerVoice`; what can be decided without a microphone lives here and is
 * tested on its own:
 *
 *   `recorderType`   which type to ask MediaRecorder for. iOS WebKit (Safari
 *                    and the WKWebView the iPhone app runs in) records
 *                    `audio/mp4` only; everything else is asked for
 *                    `audio/webm;codecs=opus`, the smallest good voice file.
 *   `uploadType`     the type and file ending a finished recording is stored
 *                    under, from what the recorder actually produced, mapped
 *                    onto the bucket's allowed audio types.
 *   `levelOf`        one loudness reading (0 to 1) from an analyser frame.
 *   `slideCancels`   whether a finger dragged far enough left to cancel.
 */

import { VOICE_TYPES } from "@/lib/messages/voice-note";

/** How far left (CSS px) a finger slides before the recording is thrown away. */
export const SLIDE_CANCEL_PX = 96;

/** How many live bars the composer draws while recording. */
export const LIVE_BARS = 28;

/** True for Safari and every iOS web view (all of which are WebKit). */
export function isAppleWebKit(ua: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  /* iPadOS reports a Mac; a Mac with a touch screen is an iPad. */
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return true;
  return /Safari\//.test(ua) && !/Chrome\/|Chromium\/|CriOS\/|Edg\/|Android/i.test(ua);
}

/**
 * The type to ask the recorder for, or undefined to let the browser choose
 * (its choice is read back from `recorder.mimeType` and mapped by
 * `uploadType`).
 */
export function recorderType(isSupported: (type: string) => boolean, apple: boolean): string | undefined {
  const order = apple
    ? ["audio/mp4", "audio/aac", "audio/webm;codecs=opus", "audio/webm"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4", "audio/aac"];
  for (const type of order) {
    try {
      if (isSupported(type)) return type;
    } catch {
      /* A browser that throws on the question has answered it. */
    }
  }
  return undefined;
}

/** The stored type and ending for what the recorder produced. */
export function uploadType(recorderMime: string | undefined | null, apple: boolean): { contentType: string; ext: string } {
  const mime = (recorderMime ?? "").toLowerCase();
  if (mime.includes("webm")) return { contentType: VOICE_TYPES.webm!, ext: "webm" };
  if (mime.includes("ogg")) return { contentType: VOICE_TYPES.ogg!, ext: "ogg" };
  if (mime.includes("mpeg") || mime.includes("mp3")) return { contentType: VOICE_TYPES.mp3!, ext: "mp3" };
  if (mime.includes("aac")) return { contentType: VOICE_TYPES.aac!, ext: "aac" };
  if (mime.includes("mp4") || mime.includes("m4a")) return { contentType: VOICE_TYPES.m4a!, ext: "m4a" };
  return apple ? { contentType: VOICE_TYPES.m4a!, ext: "m4a" } : { contentType: VOICE_TYPES.webm!, ext: "webm" };
}

/**
 * The loudest sample in one analyser frame (`getByteTimeDomainData`, silence
 * at 128), as 0 to 1.
 */
export function levelOf(frame: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < frame.length; i += 1) {
    const v = Math.abs(frame[i]! - 128);
    if (v > peak) peak = v;
  }
  return Math.min(1, peak / 128);
}

/** True once a finger has slid left past the threshold. */
export function slideCancels(dx: number, threshold = SLIDE_CANCEL_PX): boolean {
  return dx <= -threshold;
}

/** The last `n` readings, padded at the front with silence, for the live bars. */
export function liveBars(levels: readonly number[], n = LIVE_BARS): number[] {
  const tail = levels.slice(-n);
  return [...Array.from({ length: Math.max(0, n - tail.length) }, () => 0), ...tail];
}
