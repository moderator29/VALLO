import { wordsForToken } from "./errors";
import { isTerminal } from "./lifecycle";
import type { CallKind, CallSnapshot, ReviewCompletionOutcome } from "./types";

/**
 * THE CALL SCREENS' OWN RULES, as pure functions. Client-safe, no React.
 *
 * `lifecycle.ts` says what a call IS (phase, hang-up intent, who may join);
 * this file says how a screen DRAWS it: the clock that never trusts the
 * device, the refusal a start tap got, a call marker in a thread, the missed
 * call in an inbox row, which permission steps a platform needs, and the two
 * staff forms' validation. Every function here is unit tested in
 * `screen.test.ts`; the components only map their answers to words.
 */

/* ------------------------------------------------------------------ clock */

/**
 * How far the server's clock is ahead of this device, in ms. A screen keeps
 * the offset from the latest snapshot and adds it to `Date.now()`, so a phone
 * set five minutes wrong still counts a ring down and a call up correctly.
 */
export function clockOffsetMs(serverNow: string, deviceNowMs: number): number {
  const server = Date.parse(serverNow);
  return Number.isFinite(server) ? server - deviceNowMs : 0;
}

/** Seconds the call has been connected, on the server's clock. Null before it connected. */
export function talkSeconds(call: Pick<CallSnapshot, "connectedAt" | "endedAt" | "durationSeconds">, serverNowMs: number): number | null {
  if (call.durationSeconds !== null && call.endedAt) return call.durationSeconds;
  if (!call.connectedAt) return null;
  const from = Date.parse(call.connectedAt);
  if (!Number.isFinite(from)) return null;
  return Math.max(0, Math.floor((serverNowMs - from) / 1000));
}

/** "0:42", "4:12", "1:02:03": the running clock on the call screen. */
export function clockWords(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}

/** Whole seconds left on a ring, on the server's clock. Null when it is not ringing. */
export function ringSecondsLeft(call: Pick<CallSnapshot, "state" | "ringExpiresAt">, serverNowMs: number): number | null {
  if (call.state !== "RINGING" || !call.ringExpiresAt) return null;
  const until = Date.parse(call.ringExpiresAt);
  if (!Number.isFinite(until)) return null;
  return Math.max(0, Math.ceil((until - serverNowMs) / 1000));
}

/* -------------------------------------------------------------- starting */

/** What a refused `startCall` meant, so the button can draw the right thing. */
export type StartRefusal =
  | "not_engaged"
  | "blocked"
  | "caller_busy"
  | "rate_limited"
  | "disabled"
  | "unavailable"
  | "restricted"
  | "signed_out"
  | "other";

const REFUSALS: ReadonlyArray<[StartRefusal, string[]]> = [
  ["not_engaged", ["call:not_engaged"]],
  ["blocked", ["call:blocked"]],
  ["caller_busy", ["call:caller_busy"]],
  ["rate_limited", ["call:rate_limited"]],
  ["disabled", ["call:disabled", "call:provider_unavailable"]],
  ["unavailable", ["call:unavailable", "call:invalid_conversation"]],
  ["restricted", ["call:restricted"]],
  ["signed_out", ["call:signed_out"]],
];

/**
 * The action answers a sentence (`ActionResult.error`), never the token. The
 * sentences are fixed in `errors.ts`, so the token is recovered by matching
 * them; anything else is "other" and is shown as it came.
 */
export function startRefusal(error: string): StartRefusal {
  for (const [kind, tokens] of REFUSALS) {
    if (tokens.some((t) => wordsForToken(t) === error)) return kind;
  }
  return "other";
}

/** What a successful `startCall` answer asks the screen to do. */
export type StartOutcome = "outgoing" | "incoming" | "busy" | "ended";

export function startOutcome(call: Pick<CallSnapshot, "state" | "glare" | "role">): StartOutcome {
  /* Glare: they are already ringing me in this thread, so I see THEIR call. */
  if (call.glare) return "incoming";
  if (call.state === "BUSY") return "busy";
  if (isTerminal(call.state)) return "ended";
  /* A replayed tap answers the first call, whatever it has become. */
  if (call.role === "CALLEE" || call.role === "SUBJECT") return "incoming";
  return "outgoing";
}

/* --------------------------------------------------------- history rows */

export type MarkerOutcome = "talked" | "missed" | "busy" | "declined" | "cancelled" | "ended" | "failed" | "expired";

/**
 * The marker body the database writes when a conversation call finishes
 * (`private.call_on_terminal`): "Video call, 4 min 12 s", "Voice call, missed",
 * "Video call, missed (busy)". Null for anything else.
 */
export function parseCallMarker(body: string): { kind: CallKind; outcome: MarkerOutcome; seconds: number | null } | null {
  const m = /^(Video|Voice) call, (.+)$/.exec(body.trim());
  if (!m) return null;
  const kind: CallKind = m[1] === "Video" ? "VIDEO" : "AUDIO";
  const rest = m[2]!;
  const time = /^(?:(\d+) min )?(\d+) s$/.exec(rest);
  if (time) return { kind, outcome: "talked", seconds: Number(time[1] ?? 0) * 60 + Number(time[2]) };
  const words: Record<string, MarkerOutcome> = {
    missed: "missed",
    "missed (busy)": "busy",
    declined: "declined",
    cancelled: "cancelled",
    ended: "ended",
    "could not connect": "failed",
    expired: "expired",
  };
  const outcome = words[rest];
  return outcome ? { kind, outcome, seconds: null } : null;
}

const OUTCOME_OF_STATE: Partial<Record<CallSnapshot["state"], MarkerOutcome>> = {
  MISSED: "missed",
  BUSY: "busy",
  DECLINED: "declined",
  CANCELLED: "cancelled",
  FAILED: "failed",
  EXPIRED: "expired",
};

/** One call row in a thread, as the reader sees it. */
export type CallMarkerView = {
  kind: CallKind;
  outcome: MarkerOutcome;
  /** Talk time in seconds when the call connected. */
  seconds: number | null;
  /** True when this reader was called and did not take it: the red row. */
  missed: boolean;
  /** True when this reader placed the call. */
  outgoing: boolean;
};

/**
 * A marker message, from the snapshot when the history read has it (the
 * truth, per viewer) and from the body otherwise (an old client's plain
 * words, or a marker that arrived over realtime before any history read).
 * The marker's sender is always the caller, so `mine` is "I called".
 */
export function callMarkerView(input: {
  body: string;
  mine: boolean;
  snapshot?: Pick<CallSnapshot, "kind" | "state" | "durationSeconds" | "isInitiator" | "connectedAt"> | null;
}): CallMarkerView | null {
  const parsed = parseCallMarker(input.body);
  const snap = input.snapshot ?? null;
  if (!parsed && !snap) return null;
  const kind = snap?.kind ?? parsed!.kind;
  const outgoing = snap ? snap.isInitiator : input.mine;
  let outcome: MarkerOutcome;
  let seconds: number | null = null;
  if (snap) {
    if (snap.state === "ENDED") {
      outcome = snap.connectedAt && snap.durationSeconds !== null ? "talked" : "ended";
      seconds = outcome === "talked" ? snap.durationSeconds : null;
    } else {
      outcome = OUTCOME_OF_STATE[snap.state] ?? parsed?.outcome ?? "ended";
    }
  } else {
    outcome = parsed!.outcome;
    seconds = parsed!.seconds;
  }
  /* Busy and a cancel after ringing reach the callee as a missed call too
     (the database notifies them the same way). */
  const missed = !outgoing && (outcome === "missed" || outcome === "busy" || outcome === "cancelled");
  return { kind, outcome, seconds, missed, outgoing };
}

/**
 * The inbox row's missed-call line: only when the newest message in the
 * thread is a call marker (`isMarker`, read from `messages.call_id`, so a
 * typed message can never fake one), sent by the other side, and the call
 * was not taken.
 */
export function inboxMissedCall(lastMessage: string, lastFromMe: boolean, isMarker: boolean): CallKind | null {
  if (!isMarker || lastFromMe) return null;
  const view = callMarkerView({ body: lastMessage, mine: false });
  return view?.missed ? view.kind : null;
}

/* ------------------------------------------------------------ permission */

export type MediaPlatform = "iosApp" | "androidApp" | "iosWeb" | "androidWeb" | "desktop";

export function mediaPlatform(userAgent: string, native: "ios" | "android" | "unknown" | null): MediaPlatform {
  if (native === "ios") return "iosApp";
  if (native === "android") return "androidApp";
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent))) return "iosWeb";
  if (/Android/i.test(userAgent)) return "androidWeb";
  return "desktop";
}

export type MediaErrorKind = "denied" | "not_found" | "in_use" | "insecure" | "other";

/** `getUserMedia` and livekit-client errors, by their DOMException name. */
export function mediaErrorKind(error: unknown): MediaErrorKind {
  const name = error && typeof error === "object" && "name" in error ? String((error as { name: unknown }).name) : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || /permission denied|not allowed/i.test(message)) return "denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "not_found";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "in_use";
  if (name === "DeviceUnsupportedError") return "insecure";
  if (name === "SecurityError" || /secure context|getUserMedia is not|mediaDevices|undefined is not an object/i.test(message)) return "insecure";
  return "other";
}

/* ---------------------------------------------------------------- ending */

/**
 * Whether the red button asks first. A phone call never does, and neither
 * does a ringing call (cancel and decline are the point of the button). A
 * live REVIEW call does: a stray tap would cut somebody off mid-review, and
 * ringing them again needs their acceptance window.
 */
export function endNeedsConfirm(call: Pick<CallSnapshot, "purpose" | "state" | "role">): boolean {
  if (call.purpose !== "ADMIN_REVIEW" || call.role !== "REVIEWER") return false;
  return call.state === "ACTIVE" || call.state === "INTERRUPTED" || call.state === "CONNECTING" || call.state === "ACCEPTED";
}

/** Where the ended screen goes back to: the exact thread, or the review page. */
export function returnHref(call: Pick<CallSnapshot, "conversationId" | "reviewId" | "role">, pathname: string): string {
  if (call.reviewId) {
    return call.role === "REVIEWER" ? `/admin/review-calls/${call.reviewId}` : `/calls/reviews/${call.reviewId}`;
  }
  if (call.conversationId) {
    return pathname.startsWith("/agent/") ? `/agent/messages/${call.conversationId}` : `/messages/${call.conversationId}`;
  }
  return pathname.startsWith("/agent/") ? "/agent/messages" : "/messages";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A deep link's `call` parameter, or null for anything that is not a call id. */
export function callIdFromParam(value: string | string[] | null | undefined): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && UUID.test(v) ? v.toLowerCase() : null;
}

/* ----------------------------------------------------------- Lagos time */

/** Lagos is UTC+1 all year (West Africa Time, no daylight saving). */
const LAGOS_OFFSET_MS = 3_600_000;

/** "Thu 9 Oct, 14:30": a time as Lagos reads it, whatever the device's zone. */
export function lagosWords(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const shifted = new Date(t + LAGOS_OFFSET_MS);
  const day = shifted.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${day}, ${hh}:${mm}`;
}

/** A `datetime-local` value typed as Lagos time, to an ISO instant with its offset. Null if malformed. */
export function lagosInputToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const t = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)) - LAGOS_OFFSET_MS;
  if (!Number.isFinite(t)) return null;
  const check = new Date(t + LAGOS_OFFSET_MS);
  if (check.getUTCDate() !== Number(d) || check.getUTCMonth() !== Number(mo) - 1) return null;
  return new Date(t).toISOString();
}

/** An instant as a `datetime-local` value in Lagos time. */
export function isoToLagosInput(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t + LAGOS_OFFSET_MS).toISOString().slice(0, 16);
}

/* ---------------------------------------------------------- staff forms */

export type FormErrors<K extends string> = Partial<Record<K, string>>;

/**
 * The outcome form, checked before it is sent (the server checks again).
 * A follow-up needs a due date in the future; every outcome needs a summary.
 */
export function outcomeFormErrors(
  form: { outcome: ReviewCompletionOutcome | ""; summary: string; followUpDue: string },
  nowMs: number,
  words: { outcome: string; summary: string; followUp: string },
): FormErrors<"outcome" | "summary" | "followUpDue"> {
  const errors: FormErrors<"outcome" | "summary" | "followUpDue"> = {};
  if (!form.outcome) errors.outcome = words.outcome;
  if (form.summary.trim().length < 3) errors.summary = words.summary;
  if (form.outcome === "FOLLOW_UP_REQUIRED") {
    const iso = lagosInputToIso(form.followUpDue);
    if (!iso || Date.parse(iso) <= nowMs) errors.followUpDue = words.followUp;
  }
  return errors;
}

/** The request form: purpose 10..500, and a time when "At a time" is chosen. */
export function requestFormErrors(
  form: { purpose: string; when: "now" | "schedule"; at: string },
  words: { purpose: string; time: string },
): FormErrors<"purpose" | "at"> {
  const errors: FormErrors<"purpose" | "at"> = {};
  const len = form.purpose.trim().length;
  if (len < 10 || len > 500) errors.purpose = words.purpose;
  if (form.when === "schedule" && !lagosInputToIso(form.at)) errors.at = words.time;
  return errors;
}

/** Copy templating: "{name} is on another call". */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? String(values[key]) : all));
}
