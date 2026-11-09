"use server";

/**
 * REACTIONS: ADD, CHANGE AND TAKE BACK (Platform Grade 1, P1.3).
 *
 * One reaction per person per message (`message_reactions`, primary key
 * message and person), from the eight in `lib/messages/reactions.ts`. Every
 * rule lives in the database, written by the pending migration
 * `grade1_voice_notes_and_message_reactions`: members only, never across a
 * block, never on a message deleted for everyone, your own row only. These
 * actions check the person is signed in and the input is well formed, then
 * write under the person's own RLS client.
 *
 * Until that migration is applied the table does not exist; the thread reads
 * no reactions then and draws none, so these are not reached. Should one be,
 * it answers in words rather than with a code.
 */

import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { isFeatureEnabled } from "../flags";
import { clearReactionSchema, setReactionSchema } from "./schema";
import type { ReactionEmoji } from "./reactions";

const PAUSED_MESSAGE = "Messaging is paused for maintenance. Please try again in a little while.";
const FAILED_MESSAGE = "Couldn't add your reaction. Try again.";
const REMOVE_FAILED_MESSAGE = "Couldn't remove your reaction. Try again.";
const REFUSED_MESSAGE = "You can't react to this message.";
const NOT_READY_MESSAGE = "Reactions aren't switched on yet.";

function refusalFor(error: { code?: string; message?: string }, fallback: string): string {
  if (error.code === "42501") return REFUSED_MESSAGE;
  if (error.code === "42P01" || error.code === "PGRST205" || /message_reactions/.test(error.message ?? "")) {
    return NOT_READY_MESSAGE;
  }
  return fallback;
}

/** Sets the reader's reaction on a message, replacing any they had. */
export async function setReaction(input: {
  messageId: string;
  emoji: ReactionEmoji;
}): Promise<ActionResult<{ messageId: string; emoji: ReactionEmoji }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  if (!(await isFeatureEnabled("messaging"))) return fail(PAUSED_MESSAGE);

  const parsed = validate(setReactionSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const { error } = await session.supabase
    .from("message_reactions")
    .upsert(
      { message_id: parsed.data.messageId, user_id: session.user.id, emoji: parsed.data.emoji },
      { onConflict: "message_id,user_id" },
    );
  if (error) return fail(refusalFor(error, FAILED_MESSAGE));
  return ok({ messageId: parsed.data.messageId, emoji: parsed.data.emoji });
}

/** Takes the reader's reaction off a message. Nothing there is still a success. */
export async function clearReaction(input: { messageId: string }): Promise<ActionResult<{ messageId: string }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  if (!(await isFeatureEnabled("messaging"))) return fail(PAUSED_MESSAGE);

  const parsed = validate(clearReactionSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const { error } = await session.supabase
    .from("message_reactions")
    .delete()
    .eq("message_id", parsed.data.messageId)
    .eq("user_id", session.user.id);
  if (error) return fail(refusalFor(error, REMOVE_FAILED_MESSAGE));
  return ok({ messageId: parsed.data.messageId });
}
