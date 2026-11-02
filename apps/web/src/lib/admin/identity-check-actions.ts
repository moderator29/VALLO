"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "@/lib/actions/envelope";
import { ADMIN_FORBIDDEN_MESSAGE, requireAdmin } from "./guard";

/**
 * A reviewer decides a Dojah check (`public.decide_identity_check`). The
 * acting staff member is auth.uid() inside the function, never an argument;
 * the function writes the audit row and tells the person.
 */

const SERVICE_DOWN = "That did not save. Nothing changed. Try again in a moment.";

const schema = z
  .object({
    checkId: z.string().uuid(),
    approve: z.boolean(),
    reason: z.string().trim().max(500, "Keep the reason under 500 characters.").optional(),
  })
  .refine((value) => value.approve || (value.reason ?? "").length >= 12, {
    message: "Say what is wrong with it. The person is sent this, word for word.",
    path: ["reason"],
  });

const ANSWERS: Record<string, string> = {
  needs_a_reason: "Say what is wrong with it. The person is sent this, word for word.",
  not_found: "That check is no longer here. Reload the page.",
  own_check: "This is your own check, so somebody else has to decide it.",
  decided: "Somebody has already decided this check. Reload the page.",
  not_finished: "The person has not finished this check yet.",
  no_record: "No government record came back, so there is nothing to approve. Refuse it with a reason, or wait for a new check.",
  nin_elsewhere: "This NIN or BVN is already matched to another Vallo account, so it cannot be approved here. Look at both accounts first.",
  other_nin: "This account is already matched to a different NIN or BVN, so nothing was changed.",
  forbidden: ADMIN_FORBIDDEN_MESSAGE,
};

export async function decideIdentityCheck(input: { checkId: string; approve: boolean; reason?: string }): Promise<ActionResult<null>> {
  const access = await requireAdmin("kyc_review");
  if (access.state !== "admin") return fail(ADMIN_FORBIDDEN_MESSAGE);
  const parsed = validate(schema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  try {
    const { data, error } = await (access.userClient as unknown as {
      rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
    }).rpc("decide_identity_check", {
      p_check: parsed.data.checkId,
      p_approve: parsed.data.approve,
      p_note: parsed.data.reason ?? "",
    });
    if (error) return fail(SERVICE_DOWN);
    const status = data && typeof data === "object" ? String((data as { status?: unknown }).status ?? "") : "";
    if (status === "ok") {
      revalidatePath("/admin/kyc");
      return ok(null);
    }
    return fail(ANSWERS[status] ?? SERVICE_DOWN);
  } catch {
    return fail(SERVICE_DOWN);
  }
}
