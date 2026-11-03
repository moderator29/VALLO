"use server";

/**
 * Recording a rung on an agent's verification ladder.
 *
 * One rung, one decision, one row. The tier itself is never written here: a
 * database trigger recomputes `agents.verification_tier` from the rungs that
 * have actually passed, so the number a guest eventually sees can only ever be
 * the sum of decisions somebody made, never a figure typed into a form.
 *
 * The write goes through the admin's own RLS-bound client, so Postgres
 * re-checks the role on the mutation rather than trusting a page that already
 * checked. The audit line and the agent's notification are the service role's
 * work, because the audit log has no insert policy for anybody and
 * `notifications` has no client insert policy at all, both deliberately.
 *
 * Both of those are best effort and happen after the decision has committed. A
 * failed log line or a failed notification must not turn a completed, correct
 * decision into an error the operator cannot act on.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { writeAudit } from "./audit";
import { adminRefusal, requireAdmin } from "./guard";
import { createAdminClient } from "../supabase/admin";
import { writeInAppNotice } from "../notify/in-app";
import {
  VERIFICATION_LADDER,
  VERIFICATION_RUNGS,
  TIER_NAME,
  asTier,
} from "../trust/verification";

const SERVICE_DOWN =
  "The console could not reach the platform data just now. Nothing was changed. Please try again.";
const GONE = "That agent is no longer there. Refresh the queue to see the current state.";

const recordSchema = z.object({
  agentId: z.string().uuid("That agent id is not one we recognise."),
  kind: z.enum(VERIFICATION_RUNGS, { message: "Pick one of the four checks." }),
  status: z.enum(["passed", "failed"], { message: "Say whether it passed or failed." }),
  note: z
    .string()
    .trim()
    .max(400, "Keep the note under 400 characters.")
    .optional()
    .or(z.literal("")),
});

export type RecordVerificationInput = z.infer<typeof recordSchema>;

export async function recordVerificationCheck(
  input: RecordVerificationInput,
): Promise<ActionResult<null>> {
  const access = await requireAdmin();
  if (access.state !== "admin") return fail(adminRefusal(access));

  const parsed = validate(recordSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { agentId, kind, status } = parsed.data;
  const note = parsed.data.note && parsed.data.note.length > 0 ? parsed.data.note : null;

  // Failing a rung is a serious act: it can drop somebody's tier in public, so
  // it has to say why. Passing one does not need a sentence to be honest.
  if (status === "failed" && note === null) {
    return fail("Say what did not check out.", {
      note: "A failed check has to carry a reason the agent can answer.",
    });
  }

  const { data: agent, error: readError } = await access.supabase
    .from("agents")
    .select("id, user_id, display_name, verification_tier")
    .eq("id", agentId)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN);
  if (!agent) return fail(GONE);

  /* Nobody records a check on their own verification. The application and
     every document already refuse their own reviewer (the action, the
     `refuse_self_review` trigger and `review_kyc_document`); the four rungs
     were the one decision a member of staff who is also an agent could take
     about themselves, and each one raises the tier guests read. */
  if (agent.user_id === access.user.id && !access.isFounder) {
    return fail("You cannot record a check on your own verification. Leave it for another reviewer.");
  }

  const before = asTier(agent.verification_tier);

  const { error: writeError } = await access.supabase
    .from("agent_verification_checks")
    .upsert(
      {
        agent_id: agent.id,
        kind,
        status,
        note,
        decided_by: access.user.id,
        decided_at: new Date().toISOString(),
      },
      { onConflict: "agent_id,kind" },
    );
  if (writeError) return fail(SERVICE_DOWN);

  // Read the tier back rather than predicting it. The trigger owns the number,
  // and a separate statement is the only way to see what it actually wrote:
  // every subquery in one statement shares a snapshot taken before it ran.
  const { data: after } = await access.supabase
    .from("agents")
    .select("verification_tier")
    .eq("id", agent.id)
    .maybeSingle();
  const now = asTier(after?.verification_tier ?? before);

  try {
    const admin = createAdminClient();

    // Only a change of tier is worth interrupting somebody for. A rung recorded
    // that leaves them where they were is console housekeeping, not news.
    if (now !== before) {
      const climbed = now > before;
      await writeInAppNotice(admin, {
        user_id: agent.user_id,
        kind: "agent",
        title: climbed
          ? `You are now ${TIER_NAME[now].toLowerCase()} on Vallo`
          : "Your verification level has changed",
        body: climbed
          ? `${VERIFICATION_LADDER[kind].label} passed. Guests looking at your listings can see how far you have been checked.`
          : `${VERIFICATION_LADDER[kind].label} did not check out, so your level is now ${TIER_NAME[now].toLowerCase()}. ${note ?? ""}`.trim(),
        href: "/agent/verification",
      });
    }

    await writeAudit(admin, {
      actorId: access.user.id,
      action: "agent.verification_check",
      entityType: "agent",
      entityId: agent.id,
      detail: {
        rung: kind,
        status,
        tier_before: before,
        tier_after: now,
        note,
        agent_name: agent.display_name,
      },
    });
  } catch {
    // The decision is recorded and the tier is correct either way.
  }

  revalidatePath("/admin/agents");
  revalidatePath("/admin");
  return ok(null);
}
