"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "@/lib/actions/envelope";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/admin/audit";
import { adminRefusal, requireAdmin } from "@/lib/admin/guard";

const schema = z.object({
  crashId: z.uuid(),
  status: z.enum(["open", "resolved", "ignored"]),
});

/**
 * Mark one crash fixed, quiet it, or open it again (operations scope). A
 * crash marked fixed that happens again opens itself (`record_crash`); an
 * ignored one stays quiet however often it repeats. Audited with the actor.
 */
export async function setCrashStatus(input: { crashId: string; status: "open" | "resolved" | "ignored" }): Promise<ActionResult<null>> {
  const access = await requireAdmin("operations");
  if (access.state !== "admin") return fail(adminRefusal(access));
  const parsed = validate(schema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  try {
    const admin = createAdminClient();
    const closing = parsed.data.status !== "open";
    const { error } = await admin
      .from("crash_reports" as never)
      .update({
        status: parsed.data.status,
        resolved_at: closing ? new Date().toISOString() : null,
        resolved_by: closing ? access.user.id : null,
      } as never)
      .eq("id", parsed.data.crashId);
    if (error) return fail("We could not update this crash just now. Nothing has changed. Please try again.");
    await writeAudit(admin, {
      actorId: access.user.id,
      action: `crash_report.${parsed.data.status}`,
      entityType: "crash_report",
      entityId: parsed.data.crashId,
    });
  } catch {
    return fail("We could not update this crash just now. Nothing has changed. Please try again.");
  }
  revalidatePath("/admin/crashes");
  return ok(null);
}
