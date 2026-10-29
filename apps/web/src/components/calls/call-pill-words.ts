import type { Dictionary } from "@vallo/i18n/core";
import { fill, type CallMarkerView } from "@/lib/calls/screen";

/**
 * THE WORDS OF A CALL PILL IN A THREAD: who called, and what became of it, in
 * one plain line ("Missed video call from Nora", "You called Nora, cancelled",
 * "Video call with Nora, 12 min").
 *
 * Pure and client-safe so the wording is unit tested without a browser. Every
 * word comes from the `chatPolish.calls` dictionary block. A duration is only
 * ever the one the call recorded (`view.seconds`, set by the database when the
 * call connected); a call that never connected, or whose length was not
 * recorded, says no length at all rather than a guess.
 */
export type CallPillWords = Dictionary["chatPolish"]["calls"];

/** "45 s", "12 min": whole minutes once there is a minute, the call's own seconds before. */
export function callPillDuration(seconds: number | null, w: CallPillWords): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "";
  const whole = Math.floor(seconds);
  return whole >= 60 ? fill(w.minutes, { n: Math.floor(whole / 60) }) : fill(w.seconds, { n: whole });
}

/** What a finished call came to, for a call this reader placed or received and did not talk on. */
function outcomeWord(view: CallMarkerView, w: CallPillWords): string | null {
  switch (view.outcome) {
    case "cancelled":
      return w.outcomeCancelled;
    case "missed":
      return w.outcomeNoAnswer;
    case "declined":
      return w.outcomeDeclined;
    case "busy":
      return w.outcomeBusy;
    case "failed":
      return w.outcomeFailed;
    case "expired":
      return w.outcomeExpired;
    default:
      return null;
  }
}

/** The kind's noun in running text ("video call") and at the head of a line ("Video call"). */
export function callNouns(view: Pick<CallMarkerView, "kind">, w: CallPillWords): { call: string; Call: string } {
  return view.kind === "VIDEO" ? { call: w.video, Call: w.videoTitle } : { call: w.voice, Call: w.voiceTitle };
}

export function callPillSentence(view: CallMarkerView, name: string, w: CallPillWords): string {
  const nouns = callNouns(view, w);
  const who = { ...nouns, name };
  /* The red one: this reader was called and did not take it. */
  if (view.missed) return fill(w.missedFrom, who);
  if (view.outcome === "talked") {
    const duration = callPillDuration(view.seconds, w);
    return duration ? fill(w.callWith, { ...who, duration }) : fill(w.callWithNoTime, who);
  }
  const outcome = outcomeWord(view, w);
  /* An ended call with no recorded talk time: it happened, nothing more is claimed. */
  if (outcome === null) return fill(w.callWithNoTime, who);
  if (view.outgoing) return fill(w.youCalled, { ...who, outcome });
  if (view.outcome === "declined") return fill(w.youDeclined, who);
  return fill(w.callFrom, { ...who, outcome });
}

/**
 * The visible line of a call row in the thread, the way X draws one: no name,
 * the kind first and then what became of it ("Voice call ended, 12 min",
 * "Missed video call", "Video call cancelled"). The sentence with the name
 * (`callPillSentence`) stays as the row's spoken label.
 */
export function callRowText(view: CallMarkerView, w: CallPillWords): string {
  const nouns = callNouns(view, w);
  if (view.missed) return fill(w.rowMissed, nouns);
  if (view.outcome === "talked") {
    const duration = callPillDuration(view.seconds, w);
    return duration ? fill(w.rowEndedFor, { ...nouns, duration }) : fill(w.rowEnded, nouns);
  }
  const outcome = outcomeWord(view, w);
  if (outcome === null) return fill(w.rowEnded, nouns);
  const soft = view.outcome === "missed" || view.outcome === "busy" || view.outcome === "failed" || view.outcome === "expired";
  return fill(soft ? w.rowOutcomeSoft : w.rowOutcome, { ...nouns, outcome });
}
