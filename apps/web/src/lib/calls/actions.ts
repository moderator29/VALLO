"use server";

/**
 * CALLS IN MESSAGES: THE SERVER ACTIONS THE CALL SCREENS USE.
 *
 * Contract: docs/video-calling/VIDEO-CALLING-API-CONTRACTS.md. Each action is
 * a thin door onto one database function, run under the caller's own session
 * so the database decides who may do what; this file only validates input,
 * shapes the answer and starts the work that must not hold the reply up (the
 * push for an incoming call, closing a finished room).
 *
 * Every answer is the platform's `ActionResult` envelope. A refusal is a
 * sentence (lib/calls/errors.ts), never a Postgres message.
 */

import { after } from "next/server";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { pushDrain } from "../push/drain";
import { getAdminClient } from "../supabase/service";
import { wordsForToken } from "./errors";
import { snapshotFromRow } from "./lifecycle";
import { callProviderConfigured, getCallProvider } from "./provider";
import { closeEndedRooms, reconcilePresence } from "./rooms";
import { callRpc } from "./rpc";
import { callHistorySchema, callIdSchema, startCallSchema } from "./schema";
import { issueJoinCredentials } from "./token-service";
import type { CallSnapshot, JoinCredentials } from "./types";

type Session = Extract<Awaited<ReturnType<typeof resolveSession>>, { state: "signed-in" }>;

async function signedIn(): Promise<{ ok: true; session: Session } | { ok: false; error: string }> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return { ok: false, error: NOT_CONFIGURED_MESSAGE };
  if (session.state === "signed-out") return { ok: false, error: SIGNED_OUT_MESSAGE };
  return { ok: true, session };
}

function snapshotResult(data: unknown): ActionResult<CallSnapshot> {
  const snapshot = snapshotFromRow(data);
  return snapshot ? ok(snapshot) : fail(wordsForToken("call:not_found"));
}

/** Wake the push queue now, so an incoming call reaches a locked phone while it still rings. */
function pushNow(): void {
  after(async () => {
    const admin = getAdminClient();
    if (!admin) return;
    try {
      await pushDrain(admin);
    } catch {
      /* The five-minute drain is the backstop; a ring push that missed its
         45 seconds is settled as expired there, never delivered late. */
    }
  });
}

/** Close the provider room of anything that just finished. */
function closeRoomsSoon(): void {
  after(async () => {
    const admin = getAdminClient();
    const provider = getCallProvider();
    if (!admin || !provider) return;
    try {
      await closeEndedRooms(admin, provider, 10);
    } catch {
      /* The calls-sweep cron closes it on its next run. */
    }
  });
}

/** Start a voice or video call in a conversation. Rings the other person. */
export async function startCall(input: {
  conversationId: string;
  kind: "AUDIO" | "VIDEO";
  tapKey?: string;
}): Promise<ActionResult<CallSnapshot>> {
  const auth = await signedIn();
  if (!auth.ok) return fail(auth.error);
  const parsed = validate(startCallSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  /* Never ring somebody into a call nobody can connect to. */
  if (!callProviderConfigured()) return fail(wordsForToken("call:provider_unavailable"));

  const answer = await callRpc(auth.session.supabase, "call_start", {
    p_conversation: parsed.data.conversationId,
    p_kind: parsed.data.kind,
    p_client_key: parsed.data.tapKey ?? null,
  });
  if (!answer.ok) return fail(answer.words);
  const result = snapshotResult(answer.data);
  if (result.ok && result.data.state === "RINGING" && !result.data.glare && !result.data.replayed) pushNow();
  return result;
}

export async function acceptCall(input: { callId: string }): Promise<ActionResult<CallSnapshot>> {
  return simple("call_accept", input);
}

export async function declineCall(input: { callId: string }): Promise<ActionResult<CallSnapshot>> {
  return simple("call_decline", input);
}

export async function cancelCall(input: { callId: string }): Promise<ActionResult<CallSnapshot>> {
  return simple("call_cancel", input, true);
}

/** Hang up: cancels a ringing call you made, declines one you were ringing for, ends a live one. */
export async function endCall(input: { callId: string }): Promise<ActionResult<CallSnapshot>> {
  return simple("call_end", input, true);
}

async function simple(fn: string, input: { callId: string }, mayFinish = false): Promise<ActionResult<CallSnapshot>> {
  const auth = await signedIn();
  if (!auth.ok) return fail(auth.error);
  const parsed = validate(callIdSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const answer = await callRpc(auth.session.supabase, fn, { p_call: parsed.data.callId });
  if (!answer.ok) return fail(answer.words);
  const result = snapshotResult(answer.data);
  if (result.ok && (mayFinish || fn === "call_decline")) closeRoomsSoon();
  return result;
}

/**
 * The credentials to connect to the call's media room. Ask for them when
 * the call screen is about to connect (the caller while it rings, the callee
 * after answering), and again for a full reconnect. Memory only: never put
 * the token in a URL, storage or a log.
 */
export async function getJoinCredentials(input: { callId: string }): Promise<ActionResult<JoinCredentials>> {
  const auth = await signedIn();
  if (!auth.ok) return fail(auth.error);
  const parsed = validate(callIdSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const issued = await issueJoinCredentials(
    {
      joinCheck: (callId) => callRpc(auth.session.supabase, "call_join_check", { p_call: callId }),
      provider: getCallProvider(),
      onPrepareFailed: (reason) => console.warn(`[calls] room prepare failed: ${reason.slice(0, 120)}`),
    },
    parsed.data.callId,
  );
  return issued.ok ? ok(issued.credentials) : fail(issued.error);
}

/**
 * The open call screen's pulse, every `HEARTBEAT_SECONDS`. Answers the
 * current state (so a screen whose realtime dropped still learns the call
 * ended), applies any deadline that has passed, and, when the server asks
 * for it, reads the provider's own presence list into the call.
 */
export async function heartbeatCall(input: { callId: string }): Promise<ActionResult<CallSnapshot>> {
  const auth = await signedIn();
  if (!auth.ok) return fail(auth.error);
  const parsed = validate(callIdSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const first = await callRpc(auth.session.supabase, "call_heartbeat", { p_call: parsed.data.callId });
  if (!first.ok) return fail(first.words);
  const snapshot = snapshotFromRow(first.data);
  if (!snapshot) return fail(wordsForToken("call:not_found"));
  if (!snapshot.presenceCheckDue) return ok(snapshot);

  const admin = getAdminClient();
  const provider = getCallProvider();
  if (!admin || !provider) return ok(snapshot);
  const reconciled = await reconcilePresence(admin, provider, snapshot.id);
  if (!reconciled) return ok(snapshot);
  const second = await callRpc(auth.session.supabase, "call_heartbeat", { p_call: parsed.data.callId });
  return second.ok ? snapshotResult(second.data) : ok(snapshot);
}

/**
 * THE CALL RINGING THIS PERSON RIGHT NOW, IF ANY (29 October 2026, the founder:
 * "when I call someone it will not show on their end until they call me back").
 *
 * The incoming screen used to depend on one realtime message and nothing
 * else: if that message was missed (a socket that dropped on a phone, a tab
 * that slept) the call rang in the database and nowhere else until something
 * else made the app look, such as the callee calling back. This is the look.
 * It reads only the caller's own participant row (the row security rules), and
 * only a call that is still inside its ring window, so a stale row can never
 * resurrect a finished call; the heartbeat that follows is still the truth.
 */
export async function incomingCallNow(): Promise<ActionResult<{ callId: string } | null>> {
  const auth = await signedIn();
  if (!auth.ok) return fail(auth.error);
  const { data, error } = await (auth.session.supabase as unknown as {
    from(table: string): {
      select(columns: string): {
        eq(column: string, value: string): {
          eq(column: string, value: string): {
            eq(column: string, value: string): {
              gt(column: string, value: string): {
                limit(count: number): Promise<{ data: { call_id: string }[] | null; error: unknown }>;
              };
            };
          };
        };
      };
    };
  })
    .from("call_participants")
    .select("call_id, calls!inner(state, ring_expires_at)")
    .eq("user_id", auth.session.user.id)
    .eq("state", "RINGING")
    .eq("calls.state", "RINGING")
    .gt("calls.ring_expires_at", new Date().toISOString())
    .limit(1);
  if (error) return fail(wordsForToken("call:not_found"));
  const callId = data?.[0]?.call_id;
  return ok(callId ? { callId } : null);
}

/**
 * The callee's app says the ring is on its screen, so the caller can read
 * "Ringing" instead of "Calling" (29 October 2026). Stamps the callee's own
 * participant row once; a call that is not ringing for this person is a no-op.
 */
export async function ringDelivered(input: { callId: string }): Promise<ActionResult<null>> {
  const auth = await signedIn();
  if (!auth.ok) return fail(auth.error);
  const parsed = validate(callIdSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const answer = await callRpc(auth.session.supabase, "call_ring_delivered", { p_call: parsed.data.callId });
  return answer.ok ? ok(null) : fail(answer.words);
}

/** One conversation's calls, newest first, as the person asking sees them. */
export async function callHistory(input: { conversationId: string; limit?: number }): Promise<ActionResult<CallSnapshot[]>> {
  const auth = await signedIn();
  if (!auth.ok) return fail(auth.error);
  const parsed = validate(callHistorySchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const answer = await callRpc(auth.session.supabase, "call_history", {
    p_conversation: parsed.data.conversationId,
    p_limit: parsed.data.limit ?? 50,
  });
  if (!answer.ok) return fail(answer.words);
  const rows = Array.isArray(answer.data) ? answer.data : [];
  return ok(rows.map(snapshotFromRow).filter((s): s is CallSnapshot => s !== null));
}
