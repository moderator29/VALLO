import type { CallKind, CallPurpose, CallRole, CallSnapshot, CallState, ParticipantState } from "./types";

/**
 * THE CALL LIFECYCLE, AS PURE RULES. Client-safe.
 *
 * The database enforces every move (`private.call_transition_allowed` in the
 * VC1 migration). This file is the same table for the screens and the tests,
 * and `lifecycle.test.ts` reads the migration and fails if the two drift.
 *
 *   CREATED ──▶ RINGING ──▶ ACCEPTED ──▶ CONNECTING ──▶ ACTIVE ◀──▶ INTERRUPTED
 *      │           │           │             │            │              │
 *      ▼           ▼           ▼             ▼            ▼              ▼
 *  BUSY/FAILED  DECLINED    ENDED         ENDED         ENDED          ENDED
 *  CANCELLED    CANCELLED   FAILED        FAILED
 *               MISSED
 *               FAILED
 *
 * INVITATION_PENDING sits between CREATED and RINGING for an invitation made
 * ahead of its time; VC1 defines it and no function enters it yet (review
 * calls ring when staff start them, see VIDEO-CALLING-ADMIN-REVIEWS.md).
 *
 * A dropped connection is INTERRUPTED, not ENDED: it ends only when the
 * reconnect grace runs out.
 */

export const TRANSITIONS: Readonly<Record<CallState, readonly CallState[]>> = {
  CREATED: ["RINGING", "INVITATION_PENDING", "BUSY", "CANCELLED", "FAILED"],
  INVITATION_PENDING: ["RINGING", "BUSY", "CANCELLED", "EXPIRED"],
  RINGING: ["ACCEPTED", "DECLINED", "CANCELLED", "MISSED", "FAILED"],
  ACCEPTED: ["CONNECTING", "ACTIVE", "ENDED", "FAILED"],
  CONNECTING: ["ACTIVE", "ENDED", "FAILED"],
  ACTIVE: ["INTERRUPTED", "ENDED"],
  INTERRUPTED: ["ACTIVE", "ENDED"],
  ENDED: [],
  DECLINED: [],
  CANCELLED: [],
  MISSED: [],
  BUSY: [],
  FAILED: [],
  EXPIRED: [],
};

export const TERMINAL_STATES: ReadonlySet<CallState> = new Set<CallState>([
  "ENDED",
  "DECLINED",
  "CANCELLED",
  "MISSED",
  "BUSY",
  "FAILED",
  "EXPIRED",
]);

/** States in which the call still occupies both people. */
export const LIVE_STATES: ReadonlySet<CallState> = new Set<CallState>([
  "RINGING",
  "ACCEPTED",
  "CONNECTING",
  "ACTIVE",
  "INTERRUPTED",
]);

export function isTerminal(state: CallState): boolean {
  return TERMINAL_STATES.has(state);
}

export function canTransition(from: CallState, to: CallState): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Every deadline, in seconds. Mirrors `private.call_timeout_seconds`; the
 * test reads the numbers out of the migration.
 *
 *   ring             RINGING with no answer becomes MISSED
 *   connect          ACCEPTED or CONNECTING with no media becomes FAILED
 *   reconnect_grace  INTERRUPTED with nobody back becomes ENDED (connection_lost)
 *   stale_activity   ACTIVE with no heartbeat and no provider fact becomes ENDED (stale)
 *   setup            CREATED that never rang becomes FAILED
 *   review_join_early / review_join_late
 *                    how long before and after a scheduled review staff may start it
 */
export const CALL_TIMEOUTS = {
  ring: 45,
  connect: 60,
  reconnect_grace: 30,
  stale_activity: 120,
  setup: 60,
  review_join_early: 600,
  review_join_late: 1800,
} as const;

/** How often an open call screen should call `heartbeatCall`. */
export const HEARTBEAT_SECONDS = 10;

/** The default ceiling on one conversation call, and on one review call. */
export const MAX_DURATION_SECONDS = { CONVERSATION: 7200, ADMIN_REVIEW: 3600 } as const;

/**
 * Which deadline has passed, if any, for a snapshot at `now`. The same rule
 * the database applies lazily; a screen uses it to stop showing "Ringing"
 * the moment the clock runs out, before the server's answer arrives.
 */
export function overdueTransition(
  call: Pick<CallSnapshot, "state" | "ringExpiresAt" | "acceptedAt" | "interruptedAt" | "createdAt">,
  now: Date,
): { to: CallState; reason: string } | null {
  const t = now.getTime();
  const at = (iso: string | null) => (iso ? Date.parse(iso) : Number.NaN);
  switch (call.state) {
    case "RINGING":
      return at(call.ringExpiresAt) <= t ? { to: "MISSED", reason: "no_answer" } : null;
    case "CREATED":
      return at(call.createdAt) + CALL_TIMEOUTS.setup * 1000 <= t ? { to: "FAILED", reason: "setup_abandoned" } : null;
    case "ACCEPTED":
    case "CONNECTING":
      return at(call.acceptedAt) + CALL_TIMEOUTS.connect * 1000 <= t
        ? { to: "FAILED", reason: "connect_timeout" }
        : null;
    case "INTERRUPTED":
      return at(call.interruptedAt) + CALL_TIMEOUTS.reconnect_grace * 1000 <= t
        ? { to: "ENDED", reason: "connection_lost" }
        : null;
    default:
      return null;
  }
}

/** What the single red button does, for this person, in this state. */
export type HangUpIntent = "cancel" | "decline" | "end" | "none";

export function hangUpIntent(state: CallState, role: CallRole | null): HangUpIntent {
  if (isTerminal(state) || role === null) return "none";
  if (state === "CREATED" || state === "INVITATION_PENDING" || state === "RINGING") {
    return role === "CALLER" || role === "REVIEWER" ? "cancel" : "decline";
  }
  return "end";
}

/** May this person ask for a join token right now? Mirrors `public.call_join_check`. */
export function mayJoin(state: CallState, role: CallRole | null, myState: ParticipantState | null): boolean {
  if (role === null) return false;
  if (myState === "DECLINED" || myState === "REMOVED" || myState === "MISSED") return false;
  if (state === "ACCEPTED" || state === "CONNECTING" || state === "ACTIVE" || state === "INTERRUPTED") return true;
  return state === "RINGING" && (role === "CALLER" || role === "REVIEWER");
}

/**
 * The screen a person should be looking at. The frontend's single switch:
 *
 *   incoming      ringing, and this person is being called: accept / decline
 *   outgoing      ringing, and this person is calling: cancel
 *   connecting    answered, media not both up yet
 *   in_call       both connected
 *   reconnecting  one side dropped; within the grace it may come back
 *   ended         over, with the reason to show
 */
export type CallPhase = "incoming" | "outgoing" | "connecting" | "in_call" | "reconnecting" | "ended";

export function callPhase(state: CallState, role: CallRole | null): CallPhase {
  if (isTerminal(state)) return "ended";
  if (state === "CREATED" || state === "INVITATION_PENDING" || state === "RINGING") {
    return role === "CALLEE" || role === "SUBJECT" ? "incoming" : "outgoing";
  }
  if (state === "ACTIVE") return "in_call";
  if (state === "INTERRUPTED") return "reconnecting";
  return "connecting";
}

/** Plain words for how a call finished, from the viewer's side. No em dashes. */
export function endReasonWords(call: Pick<CallSnapshot, "state" | "endReason" | "isInitiator" | "kind">): string {
  const noun = call.kind === "AUDIO" ? "voice call" : "video call";
  switch (call.state) {
    case "MISSED":
      return call.isInitiator ? "No answer" : `Missed ${noun}`;
    case "DECLINED":
      return call.isInitiator ? "Call declined" : "You declined";
    case "CANCELLED":
      return call.isInitiator ? "Call cancelled" : `Missed ${noun}`;
    case "BUSY":
      return call.isInitiator ? "They are on another call" : `Missed ${noun}`;
    case "FAILED":
      return "The call could not connect";
    case "EXPIRED":
      return "The invitation expired";
    case "ENDED":
      if (call.endReason === "connection_lost") return "The connection was lost";
      if (call.endReason === "max_duration") return "The call reached its time limit";
      return "Call ended";
    default:
      return "";
  }
}

/** "4 min 12 s", "45 s". The same words the conversation marker uses. */
export function durationWords(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "";
  const s = Math.floor(seconds);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return mins > 0 ? `${mins} min ${secs} s` : `${secs} s`;
}

type Row = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

const STATES = new Set<string>(Object.keys(TRANSITIONS));
const ROLES = new Set<string>(["CALLER", "CALLEE", "REVIEWER", "SUBJECT"]);
const PSTATES = new Set<string>(["INVITED", "RINGING", "ACCEPTED", "DECLINED", "JOINED", "LEFT", "MISSED", "REMOVED"]);

/**
 * The database's `private.call_snapshot` jsonb, read defensively into a
 * `CallSnapshot`. Returns null for anything that is not a call.
 */
export function snapshotFromRow(raw: unknown): CallSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Row;
  const id = str(r.id);
  const state = str(r.state);
  const kind = str(r.kind);
  if (!id || !state || !STATES.has(state) || (kind !== "AUDIO" && kind !== "VIDEO")) return null;
  const role = str(r.role);
  const myState = str(r.my_state);
  const otherState = str(r.other_state);
  const snapshot: CallSnapshot = {
    id,
    kind: kind as CallKind,
    purpose: (str(r.purpose) === "ADMIN_REVIEW" ? "ADMIN_REVIEW" : "CONVERSATION") as CallPurpose,
    state: state as CallState,
    version: num(r.version) ?? 0,
    conversationId: str(r.conversation_id),
    reviewId: str(r.review_id),
    role: role && ROLES.has(role) ? (role as CallRole) : null,
    myState: myState && PSTATES.has(myState) ? (myState as ParticipantState) : null,
    isInitiator: r.is_initiator === true,
    otherName: str(r.other_name),
    otherState: otherState && PSTATES.has(otherState) ? (otherState as ParticipantState) : null,
    scheduledFor: str(r.scheduled_for),
    createdAt: str(r.created_at) ?? "",
    ringingAt: str(r.ringing_at),
    ringExpiresAt: str(r.ring_expires_at),
    acceptedAt: str(r.accepted_at),
    connectedAt: str(r.connected_at),
    interruptedAt: str(r.interrupted_at),
    endedAt: str(r.ended_at),
    endReason: str(r.end_reason),
    durationSeconds: num(r.duration_seconds),
    serverNow: str(r.server_now) ?? new Date().toISOString(),
  };
  const avatar = str(r.other_avatar_url);
  if (avatar) snapshot.otherAvatarUrl = avatar;
  if (r.other_ringing === true) snapshot.otherRinging = true;
  if (r.glare === true) snapshot.glare = true;
  if (r.replayed === true) snapshot.replayed = true;
  if (r.presence_check_due === true) snapshot.presenceCheckDue = true;
  return snapshot;
}

/**
 * Which of two views of one call to keep. Realtime, a heartbeat and an action
 * reply can arrive in any order; the higher version wins, and a terminal
 * state is never replaced by a live one.
 */
export function newerSnapshot(current: CallSnapshot | null, incoming: CallSnapshot): CallSnapshot {
  if (!current || current.id !== incoming.id) return incoming;
  if (isTerminal(current.state) && !isTerminal(incoming.state)) return current;
  return incoming.version >= current.version ? incoming : current;
}
