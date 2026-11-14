"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { recordAlert } from "../alerts";
import type { Db } from "../money/member-wallet";
import { instructDisputeRelease, instructProtectedRefund, protectedRailDeps, type ActOutcome } from "../money/protected-rail";
import { consume, subjectForUser } from "../security/rate-limit";
import { createAdminClient } from "../supabase/admin";
import { writeAudit } from "./audit";
import { adminRefusal, requireAdmin } from "./guard";

/**
 * THE DISPUTE DECISION ON A PROTECTED PAYMENT (BUILD 7.11, "the dispute desk").
 *
 * Vallo runs its own dispute process; the provider holds the money and moves
 * it only on Vallo's instruction. This is that instruction, and the only
 * place staff give it:
 *
 *   refund   the whole amount back to the payer (money held, or disputed)
 *   release  the whole amount to the lister (a disputed payment only; the
 *            ordinary release is the payer's own confirmation)
 *
 * The door is finance (`requireAdmin("finance")`, a proved console session).
 * A reason is required and kept: on the arrangement's own event trail (the
 * rail writes it), and in the audit log, written here BEFORE the instruction
 * is given, so no instruction exists without its line. The instruction
 * itself only ASKS: the record reads refunded or released once the
 * provider reports it, never on this press.
 */
const schema = z.object({
  arrangementId: z.string().uuid("That payment could not be found."),
  decision: z.enum(["refund", "release"]),
  reason: z.string().trim().min(20, "Give the reason for this decision, in at least 20 characters.").max(500, "Keep the reason under 500 characters."),
});

export type ArrangementDecisionInput = z.input<typeof schema>;

const REFUSED: Record<string, string> = {
  not_found: "That payment could not be found.",
  not_configured: "The payment partner cannot be instructed from this deployment. Nothing was sent.",
  release_paused: "The release of this payment is paused. Lift the pause before deciding it.",
  store_unavailable: "The record could not be read just now. Nothing was sent; try again.",
};

function words(out: Extract<ActOutcome, { outcome: "refused" }>): string {
  if (out.reason.startsWith("not_refundable:") || out.reason.startsWith("not_releasable:")) {
    return `This payment is ${out.reason.split(":")[1]?.replace(/_/g, " ")}; that decision cannot be made on it now. Nothing was sent.`;
  }
  return REFUSED[out.reason] ?? "The payment partner refused the instruction. Nothing has moved; the record is as it was.";
}

export async function decideArrangement(input: ArrangementDecisionInput): Promise<ActionResult<{ submitted: boolean }>> {
  const access = await requireAdmin("finance");
  if (access.state !== "admin") return fail(adminRefusal(access));
  const parsed = validate(schema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { arrangementId, decision, reason } = parsed.data;

  const limit = await consume({ bucket: "admin_arrangement_decision", limit: 10, windowSeconds: 600, subject: subjectForUser(access.user.id) });
  if (!limit.allowed) return fail("That is a lot of decisions in a short while. Wait a few minutes, then try again.");

  let service: ReturnType<typeof createAdminClient>;
  try {
    service = createAdminClient();
  } catch {
    return fail(REFUSED.store_unavailable!);
  }

  /* The line exists before the instruction does. */
  const logged = await writeAudit(service, {
    actorId: access.user.id,
    action: decision === "refund" ? "arrangement.refund_instructed" : "arrangement.dispute_release_instructed",
    entityType: "provider_arrangement",
    entityId: arrangementId,
    detail: { reason },
  });
  if (!logged) return fail("The decision could not be recorded, so it was not sent. Nothing has moved; try again.");

  const deps = protectedRailDeps(service as unknown as Db, async (kind, detail) => {
    await recordAlert({ kind, severity: "critical", detail });
  });
  const instruction = { arrangementId, staffUserId: access.user.id, reason };
  const out = decision === "refund" ? await instructProtectedRefund(deps, instruction) : await instructDisputeRelease(deps, instruction);

  revalidatePath("/admin/arrangements");
  revalidatePath(`/admin/arrangements/${arrangementId}`);
  if (out.outcome === "refused") {
    /* The trail says the instruction was not given, and why. */
    await writeAudit(service, {
      actorId: access.user.id,
      action: "arrangement.decision_not_sent",
      entityType: "provider_arrangement",
      entityId: arrangementId,
      detail: { decision, why: out.reason },
    });
    return fail(words(out));
  }
  /* No answer from the provider is not success: the record says what it says, and the read-back settles it. */
  return ok({ submitted: out.outcome === "submitted" });
}
