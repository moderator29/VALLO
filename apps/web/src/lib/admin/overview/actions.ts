"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { adminRefusal, requireAdmin } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNotLive } from "@/lib/features/degrade";
import { requireCoo, cooRefusal } from "./guard";

/**
 * THE COO DESK'S OWN WRITES: escalations and staff access recommendations.
 *
 * Raising an escalation is open to any admin or super admin (a team lead
 * acting outside the console, or an admin), through `requireAdmin()` with
 * no scope, exactly as the brief asks. Resolving one, and recommending a
 * staff access change, both need the full COO bundle or a super admin:
 * `requireCoo()`. Neither path grants or revokes anything: a
 * recommendation is a note for the super admin, read on the COO desk; the
 * real grant still happens only through the Staff desk
 * (`admin_grant_staff`/`admin_revoke_staff`), untouched by this file.
 */

const NOT_OPEN = "This is not set up on this server yet.";
const FAILED = "That did not go through. Try again.";
const PATH = "/admin/overview";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

function words(error: unknown): string {
  if (isNotLive(error)) return NOT_OPEN;
  if ((error as { code?: string } | null)?.code === "42501") return "Your access does not allow this.";
  return FAILED;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCE_DESKS = [
  "listing_approval",
  "moderation",
  "support",
  "agreements",
  "operations",
  "business_development",
  "social_media",
  "other",
] as const;

function trimmed(v: string | undefined | null, max: number): string {
  return (v ?? "").trim().slice(0, max);
}

async function audit(admin: SupabaseClient, actorId: string, action: string, entityId: string | null, detail: Record<string, string | number | boolean | null> = {}): Promise<void> {
  try {
    await writeAudit(admin, { actorId, action, entityType: "coo_escalation", entityId, detail });
  } catch {
    /* Reported by writeAudit's own alert. */
  }
}

export type RaiseEscalationInput = { sourceDesk: string; subject: string; detail: string };

/** Any admin or super admin may raise one; the write goes through the
 * service client, matching how every service-role write in this console
 * (the staff grants, the audit log) is done. */
export async function raiseEscalation(input: RaiseEscalationInput): Promise<ActionResult<{ id: string }>> {
  const access = await requireAdmin();
  if (access.state !== "admin") return fail(adminRefusal(access));

  const subject = trimmed(input.subject, 200);
  const detail = trimmed(input.detail, 4000);
  const fieldErrors: Record<string, string> = {};
  if (!subject) fieldErrors.subject = "Say what this is about.";
  if (!detail) fieldErrors.detail = "Say what you need decided.";
  if (!(SOURCE_DESKS as readonly string[]).includes(input.sourceDesk)) fieldErrors.sourceDesk = "Choose a desk.";
  if (Object.keys(fieldErrors).length > 0) return fail("Please check the highlighted fields and try again.", fieldErrors);

  let admin: SupabaseClient;
  try {
    admin = createAdminClient();
  } catch {
    return fail(NOT_OPEN);
  }
  const { data, error } = await (admin as Loose)
    .from("coo_escalations")
    .insert({ raised_by: access.user.id, source_desk: input.sourceDesk, subject, detail, status: "open" })
    .select("id")
    .single();
  if (error) return fail(words(error));
  await audit(admin, access.user.id, "coo.escalation.raised", data.id as string, { source_desk: input.sourceDesk });
  revalidatePath(PATH);
  return ok({ id: data.id as string });
}

export type ResolveEscalationInput = { id: string; status: "in_progress" | "resolved"; note?: string };

/** The full COO scope bundle, or a super admin. */
export async function resolveEscalation(input: ResolveEscalationInput): Promise<ActionResult> {
  const access = await requireCoo();
  if (access.state !== "coo") return fail(cooRefusal(access));
  if (!uuid.test(input.id)) return fail(FAILED);

  const patch: Record<string, unknown> =
    input.status === "resolved"
      ? { status: "resolved", resolved_by: access.user.id, resolved_at: new Date().toISOString(), resolution_note: trimmed(input.note, 2000) || null }
      : { status: "in_progress" };

  const { data, error } = await (access.supabase as Loose).from("coo_escalations").update(patch).eq("id", input.id).select("id");
  if (error) return fail(words(error));
  if (!data || data.length === 0) return fail("Could not find that escalation.");

  let admin: SupabaseClient | null = null;
  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }
  if (admin) await audit(admin, access.user.id, `coo.escalation.${input.status}`, input.id, {});
  revalidatePath(PATH);
  return ok(null);
}

export type RecommendStaffAccessInput = { aboutName: string; recommendedPositionOrScope: string; reason: string };

/** "Recommend staff access changes to the super admin as the team changes"
 * (JOB_DESCRIPTIONS.coo). Writes a note only; grants nothing. */
export async function recommendStaffAccess(input: RecommendStaffAccessInput): Promise<ActionResult<{ id: string }>> {
  const access = await requireCoo();
  if (access.state !== "coo") return fail(cooRefusal(access));

  const aboutName = trimmed(input.aboutName, 200);
  const what = trimmed(input.recommendedPositionOrScope, 200);
  const reason = trimmed(input.reason, 2000);
  const fieldErrors: Record<string, string> = {};
  if (!aboutName) fieldErrors.aboutName = "Say who this is about.";
  if (!what) fieldErrors.recommendedPositionOrScope = "Say what position or scope you recommend.";
  if (!reason) fieldErrors.reason = "Say why.";
  if (Object.keys(fieldErrors).length > 0) return fail("Please check the highlighted fields and try again.", fieldErrors);

  const { data, error } = await (access.supabase as Loose)
    .from("staff_access_recommendations")
    .insert({ recommended_by: access.user.id, about_name: aboutName, recommended_position_or_scope: what, reason, status: "open" })
    .select("id")
    .single();
  if (error) return fail(words(error));
  let admin: SupabaseClient | null = null;
  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }
  if (admin) await audit(admin, access.user.id, "coo.staff_access_recommended", data.id as string, { about_name: aboutName, what });
  revalidatePath(PATH);
  return ok({ id: data.id as string });
}
