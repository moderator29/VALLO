"use server";

/**
 * PIN AND MUTE A CONVERSATION (Platform Grade 1, inbox polish, job 8).
 *
 * Writes the member's own row in `public.conversation_prefs` under their RLS
 * client: the policies allow only their own rows and only for a conversation
 * they are in, and a trigger refuses a sixth pin (VP005). Nothing here tells
 * the other person anything. Until the migration is applied the inbox does
 * not offer these; should one be reached, it answers in words.
 */

import { fail, ok, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { PIN_LIMIT, muteUntil, type MuteFor } from "./conversation-prefs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_READY = "Pin and mute aren't switched on yet.";
const PIN_FAILED = "Couldn't pin this chat. Try again.";
const MUTE_FAILED = "Couldn't change notifications for this chat. Try again.";

function refusal(error: { code?: string; message?: string }, fallback: string): string {
  if (error.code === "VP005") return `You can pin up to ${PIN_LIMIT} conversations.`;
  if (error.code === "42P01" || error.code === "PGRST205" || /conversation_prefs/.test(error.message ?? "")) return NOT_READY;
  if (error.code === "42501") return "That conversation is not on your account.";
  return fallback;
}

async function write(
  conversationId: string,
  patch: { pinned_at?: string | null; muted_until?: string | null },
  fallback: string,
): Promise<ActionResult<{ pinnedAt: string | null; mutedUntil: string | null }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  if (!UUID_RE.test(conversationId ?? "")) return fail("This conversation could not be identified.");
  const { data, error } = await session.supabase
    .from("conversation_prefs")
    .upsert({ user_id: session.user.id, conversation_id: conversationId, ...patch }, { onConflict: "user_id,conversation_id" })
    .select("pinned_at, muted_until")
    .single();
  if (error || !data) return fail(error ? refusal(error, fallback) : fallback);
  return ok({ pinnedAt: data.pinned_at, mutedUntil: data.muted_until });
}

/** Pins (or unpins) a conversation to the top of the member's own inbox. */
export async function pinConversation(input: {
  conversationId: string;
  pinned: boolean;
}): Promise<ActionResult<{ pinnedAt: string | null; mutedUntil: string | null }>> {
  return write(input?.conversationId, { pinned_at: input?.pinned ? new Date().toISOString() : null }, PIN_FAILED);
}

/** Mutes a conversation's notifications for a while (or for good), or unmutes it with null. */
export async function muteConversation(input: {
  conversationId: string;
  until: MuteFor | null;
}): Promise<ActionResult<{ pinnedAt: string | null; mutedUntil: string | null }>> {
  const choice = input?.until;
  if (choice !== null && choice !== "8h" && choice !== "week" && choice !== "always") return fail(MUTE_FAILED);
  return write(input.conversationId, { muted_until: choice ? muteUntil(choice) : null }, MUTE_FAILED);
}
