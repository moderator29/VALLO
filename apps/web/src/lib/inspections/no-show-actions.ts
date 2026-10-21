"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { resolveSession } from "../actions/session";
import { adminRefusal, requireAdmin } from "../admin/guard";
import { writeAudit } from "../admin/audit";
import { createAdminClient } from "../supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A VIEWING ONE SIDE SAYS THE OTHER DID NOT COME TO.
 *
 * Three doors, each a SECURITY DEFINER function in
 * `..._a_viewing_nobody_came_to_and_reminders_for_both_sides.sql`, which
 * decides everything (who, when, once) off `auth.uid()`:
 *
 *   reportNoShow   either party, from the agreed time to 14 days after it
 *   disputeNoShow  the party said to have stayed away, within 48 hours
 *   resolveNoShow  staff, on a disputed one: upheld or overturned
 *
 * These validate shapes and turn the function's hint into a sentence. This
 * module exports only async functions, per the server-actions rule.
 */

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { hint?: string; message?: string } | null }>;

const id = z.string().uuid();
const noteSchema = z.string().trim().max(400, "Keep this under 400 characters.").optional();

const REFUSALS: Record<string, string> = {
  no_show_not_found: "We could not find that viewing. Refresh to see your current viewings.",
  no_show_not_booked: "Only a booked viewing can be marked as a no-show. Refresh to see where this one stands.",
  no_show_too_early: "You can say they did not come once the viewing time has come.",
  no_show_too_late: "It is more than 14 days since this viewing, so it can no longer be marked as a no-show.",
  no_show_not_yours: "Only the person marked as absent can dispute this.",
  no_show_already_disputed: "You have already disputed this. Vallo is looking at it.",
  no_show_dispute_closed: "The 48 hours to dispute this have passed.",
  no_show_no_dispute: "There is no open dispute on this viewing.",
  no_show_already_resolved: "This dispute has already been decided.",
  no_show_party: "You are part of this viewing, so another member of staff must decide this dispute.",
};

function refusal(error: { hint?: string; message?: string } | null): string {
  return (error?.hint && REFUSALS[error.hint]) || "We could not save that. Try again in a moment.";
}

function revalidateViewings() {
  revalidatePath("/bookings");
  revalidatePath("/agent/inspections");
  revalidatePath("/agent/dashboard");
}

export async function reportNoShow(input: unknown): Promise<ActionResult<null>> {
  const parsed = validate(z.object({ id, note: noteSchema }), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail("Sign in to report a no-show.");
  const rpc = session.supabase.rpc.bind(session.supabase) as unknown as Rpc;
  const { error } = await rpc("report_inspection_no_show", {
    p_inspection: parsed.data.id,
    p_note: parsed.data.note && parsed.data.note.length > 0 ? parsed.data.note : null,
  });
  if (error) return fail(refusal(error));
  revalidateViewings();
  return ok(null);
}

export async function disputeNoShow(input: unknown): Promise<ActionResult<null>> {
  const parsed = validate(z.object({ id, note: noteSchema }), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail("Sign in to dispute this.");
  const rpc = session.supabase.rpc.bind(session.supabase) as unknown as Rpc;
  const { error } = await rpc("dispute_inspection_no_show", {
    p_inspection: parsed.data.id,
    p_note: parsed.data.note && parsed.data.note.length > 0 ? parsed.data.note : null,
  });
  if (error) return fail(refusal(error));
  revalidateViewings();
  return ok(null);
}

/** Everybody a no-show dispute is about, or null when it cannot be read. */
async function viewingParties(inspectionId: string): Promise<string[] | null> {
  try {
    /* `inspection_no_shows` is newer than the generated types. */
    const admin = createAdminClient() as unknown as SupabaseClient;
    const [noShow, viewing] = await Promise.all([
      admin.from("inspection_no_shows").select("reported_by, absent_id").eq("inspection_id", inspectionId).maybeSingle(),
      admin.from("inspection_requests").select("requester_id, lister_id").eq("id", inspectionId).maybeSingle(),
    ]);
    if (noShow.error || viewing.error) return null;
    /* No row at all is left to the function's own "no open dispute". */
    const n = noShow.data as { reported_by?: unknown; absent_id?: unknown } | null;
    const v = viewing.data as { requester_id?: unknown; lister_id?: unknown } | null;
    return [n?.reported_by, n?.absent_id, v?.requester_id, v?.lister_id].filter((who): who is string => typeof who === "string");
  } catch {
    return null;
  }
}

/** Staff decide a disputed no-show. Audited; the function resolves its alert. */
export async function resolveNoShow(input: unknown): Promise<ActionResult<null>> {
  const access = await requireAdmin("operations");
  if (access.state !== "admin") return fail(adminRefusal(access));
  const parsed = validate(z.object({ id, upheld: z.boolean() }), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  /* Nobody decides a dispute they are part of: not the person who reported
     the no-show, not the person said to have stayed away, and not either
     side of the viewing. The database function checks the role but not the
     person (and a scoped staff member calls it through the service role), so
     the refusal is here, read through the service role after the staff
     check. A row that cannot be read is not decided. */
  const parties = await viewingParties(parsed.data.id);
  if (parties === null) return fail("We could not check this dispute just now. Nothing was decided. Try again in a moment.");
  if (parties.includes(access.user.id)) {
    return fail("You are part of this viewing, so another member of staff must decide this dispute. Leave it in the queue for a colleague.");
  }
  const rpc = access.supabase.rpc.bind(access.supabase) as unknown as Rpc;
  const { error } = await rpc("resolve_inspection_no_show", {
    p_inspection: parsed.data.id,
    p_upheld: parsed.data.upheld,
  });
  if (error) return fail(refusal(error));
  try {
    await writeAudit(createAdminClient(), {
      actorId: access.user.id,
      action: "inspection_no_show.resolve",
      entityType: "inspection_request",
      entityId: parsed.data.id,
      detail: { resolution: parsed.data.upheld ? "upheld" : "overturned" },
    });
  } catch {
    /* Best effort, as every other admin decision's audit row. */
  }
  revalidatePath("/admin/operations");
  revalidatePath("/admin/alerts");
  return ok(null);
}
