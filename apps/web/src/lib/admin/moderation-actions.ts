"use server";

/**
 * Releasing and removing what the scanner is holding.
 *
 * Four kinds of held thing, two decisions each: let it through, or take it
 * down. Every decision goes through one database function,
 * `public.moderation_decide`, called with the caller's own client, which
 * checks the moderation scope on auth.uid(), changes the row only while it
 * is HELD and writes the audit row in the same transaction. The tables'
 * update guards accept the change only when it comes through that function
 * (`private.may_moderate`, migration 20260929012228).
 *
 * Notifications are NOT written here. Every one of these four transitions
 * already fans out from a database trigger, which is the right place for it:
 * the notification then follows the row wherever it is changed from, including
 * from SQL at three in the morning, rather than following one code path.
 *
 * 29 September: every decision goes through public.moderation_decide, which
 * checks the moderation scope, changes the row and writes its audit line in
 * one transaction. Staff holding the moderation scope decide here as well as
 * admins, and no decision can commit without its record.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { adminRefusal, requireAdmin } from "./guard";

const SERVICE_DOWN =
  "The console could not reach the platform data just now. Nothing was changed. Please try again.";
const GONE = "That record is no longer held. Refresh the queue to see the current state.";

export type ModerationTarget = "post" | "story" | "comment" | "bio";
export type ModerationDecision = "RELEASE" | "REMOVE";

const decideSchema = z.object({
  target: z.enum(["post", "story", "comment", "bio"]),
  id: z.string().uuid("That record id is not one we recognise."),
  decision: z.enum(["RELEASE", "REMOVE"]),
  reason: z
    .string()
    .trim()
    .max(400, "Keep the reason under 400 characters.")
    .optional()
    .or(z.literal("")),
});

/**
 * A removal has to say why.
 *
 * The reason is written onto the row and the notification trigger reads it
 * straight back to the author, so this is not paperwork: it is the sentence the
 * person is going to be shown. A takedown with no explanation is the thing that
 * makes people believe a platform is arbitrary.
 */
const REASON_REQUIRED = "Say why this is coming down. The author is shown exactly what you write.";

export async function decideHeldItem(input: {
  target: ModerationTarget;
  id: string;
  decision: ModerationDecision;
  reason?: string;
}): Promise<ActionResult<null>> {
  /* Moderation-scoped staff decide held items too (Track K). */
  const access = await requireAdmin("moderation");
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(decideSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { target, id, decision } = parsed.data;
  const reason = (parsed.data.reason ?? "").trim();

  if (decision === "REMOVE" && reason.length === 0) {
    return fail(REASON_REQUIRED, { reason: REASON_REQUIRED });
  }

  /*
   * ONE DOOR, IN THE DATABASE. `public.moderation_decide` checks
   * `private.staff_can(auth.uid(), 'moderation')`, changes the row only while
   * it is still HELD, and writes the audit row in the same transaction. It is
   * called with the caller's OWN client because it decides on auth.uid():
   * a staff member's service client has none, and a direct table write from
   * it used to be put back by the update guards while this action reported
   * success. The author's notice is the tables' own status triggers.
   */
  let status = "";
  try {
    const { data, error } = await (access.userClient as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
    }).rpc("moderation_decide", {
      p_target: target,
      p_id: id,
      p_decision: decision,
      p_reason: reason.length > 0 ? reason : null,
    });
    if (error) return fail(SERVICE_DOWN);
    status = String((data as { status?: unknown } | null)?.status ?? "");
  } catch {
    return fail(SERVICE_DOWN);
  }
  if (status === "gone") return fail(GONE);
  if (status === "reason_needed") return fail(REASON_REQUIRED, { reason: REASON_REQUIRED });
  if (status === "forbidden") return fail(adminRefusal({ state: "not-admin" }));
  /* Pending migration 20261017120000: a moderator's own held words. */
  if (status === "own_content") {
    return fail("This is your own post, story, comment or bio, so another moderator has to decide it. Nothing was changed.");
  }
  if (status !== "ok") return fail(SERVICE_DOWN);

  revalidatePath("/admin/queue");
  revalidatePath("/admin");
  return ok(null);
}
