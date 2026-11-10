"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { adminRefusal, requireAdmin } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNotLive } from "@/lib/features/degrade";
import { BD_CATEGORIES, BD_STAGES, type BdCategory, type BdStage } from "./types";

/**
 * THE BUSINESS DEVELOPMENT DESK'S OWN WRITES.
 *
 * Every export here checks `requireAdmin("business_development")` itself,
 * never trusting the page alone. `bd_prospects` and `bd_prospect_activity`
 * do not exist until the pending SQL lands; every write answers that
 * honestly ("not set up yet") rather than a raw database error.
 */

const NOT_OPEN = "The partnership pipeline is not set up on this server yet.";
const FAILED = "That did not go through. Try again.";
const PATH = "/admin/business-development";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
type Staff = { db: SupabaseClient; actorId: string };

async function staff(): Promise<Staff | { error: string }> {
  const access = await requireAdmin("business_development");
  if (access.state !== "admin") return { error: adminRefusal(access) };
  return { db: access.supabase, actorId: access.user.id };
}

function words(error: unknown): string {
  if (isNotLive(error)) return NOT_OPEN;
  if ((error as { code?: string } | null)?.code === "42501") return "Your staff role does not allow this.";
  return FAILED;
}

async function audit(s: Staff, action: string, entityId: string | null, detail: Record<string, string | number | boolean | null> = {}): Promise<void> {
  try {
    await writeAudit(createAdminClient(), { actorId: s.actorId, action, entityType: "bd_prospect", entityId, detail });
  } catch {
    /* The write itself already succeeded; a missing audit line is reported
       by `writeAudit`'s own alert, not turned into a refusal here. */
  }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isCategory = (v: string): v is BdCategory => (BD_CATEGORIES as readonly string[]).includes(v);
const isStage = (v: string): v is BdStage => (BD_STAGES as readonly string[]).includes(v);

function trimmed(v: string | undefined | null, max: number): string | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  return t.slice(0, max);
}

export type AddProspectInput = {
  contactName: string;
  businessName: string;
  category: string;
  email?: string;
  phone?: string;
  location?: string;
  notes?: string;
  nextFollowUpAt?: string;
};

/** Add a prospect to the pipeline. */
export async function addProspect(input: AddProspectInput): Promise<ActionResult<{ id: string }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);

  const contactName = trimmed(input.contactName, 160);
  const businessName = trimmed(input.businessName, 160);
  const email = trimmed(input.email, 200);
  const phone = trimmed(input.phone, 40);
  const fieldErrors: Record<string, string> = {};
  if (!contactName) fieldErrors.contactName = "Enter who you are talking to.";
  if (!businessName) fieldErrors.businessName = "Enter the business name.";
  if (!isCategory(input.category)) fieldErrors.category = "Choose a category.";
  if (!email && !phone) {
    fieldErrors.email = "Add an email or a phone number.";
    fieldErrors.phone = "Add an email or a phone number.";
  }
  if (Object.keys(fieldErrors).length > 0) return fail("Please check the highlighted fields and try again.", fieldErrors);

  const row = {
    contact_name: contactName,
    business_name: businessName,
    category: input.category,
    email,
    phone,
    location: trimmed(input.location, 200),
    notes: trimmed(input.notes, 4000),
    next_follow_up_at: input.nextFollowUpAt || null,
    stage: "new",
    created_by: s.actorId,
    assigned_to: s.actorId,
  };
  const { data, error } = await (s.db as Loose).from("bd_prospects").insert(row).select("id").single();
  if (error) return fail(words(error));
  await audit(s, "bd.prospect.added", data.id as string, { business_name: businessName, category: input.category });
  revalidatePath(PATH);
  return ok({ id: data.id as string });
}

/** Move a prospect to a new stage, logging the change in the activity log. */
export async function changeStage(input: { prospectId: string; stage: string; note?: string }): Promise<ActionResult> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!uuid.test(input.prospectId)) return fail(FAILED);
  if (!isStage(input.stage)) return fail("Choose a stage.", { stage: "Choose a stage." });

  const patch: Record<string, unknown> = { stage: input.stage };
  if (input.stage === "onboarded") patch.onboarded_at = new Date().toISOString();

  const { data, error } = await (s.db as Loose)
    .from("bd_prospects")
    .update(patch)
    .eq("id", input.prospectId)
    .select("id, stage");
  if (error) return fail(words(error));
  if (!data || data.length === 0) return fail("Could not find that prospect.");

  const note = trimmed(input.note, 2000) ?? `Moved to ${input.stage.replace(/_/g, " ")}.`;
  await (s.db as Loose).from("bd_prospect_activity").insert({
    prospect_id: input.prospectId,
    kind: "stage_change",
    body: note,
    actor_id: s.actorId,
  });
  await audit(s, "bd.prospect.stage_changed", input.prospectId, { stage: input.stage });
  revalidatePath(PATH);
  return ok(null);
}

/** Set, change or clear a prospect's next follow-up date. */
export async function setNextFollowUp(input: { prospectId: string; date: string | null }): Promise<ActionResult> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!uuid.test(input.prospectId)) return fail(FAILED);
  const { data, error } = await (s.db as Loose)
    .from("bd_prospects")
    .update({ next_follow_up_at: input.date || null })
    .eq("id", input.prospectId)
    .select("id");
  if (error) return fail(words(error));
  if (!data || data.length === 0) return fail("Could not find that prospect.");
  revalidatePath(PATH);
  return ok(null);
}

/** Link a prospect to the real listing it produced, for the "complete
 * listings submitted" figure. Never set automatically. */
export async function linkListing(input: { prospectId: string; listingId: string | null }): Promise<ActionResult> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!uuid.test(input.prospectId)) return fail(FAILED);
  if (input.listingId && !uuid.test(input.listingId)) return fail("That does not look like a listing id.", { listingId: "That does not look like a listing id." });
  const { data, error } = await (s.db as Loose)
    .from("bd_prospects")
    .update({ listing_id: input.listingId })
    .eq("id", input.prospectId)
    .select("id");
  if (error) return fail(words(error));
  if (!data || data.length === 0) return fail("Could not find that prospect.");
  await audit(s, "bd.prospect.listing_linked", input.prospectId, { listing_id: input.listingId ?? "" });
  revalidatePath(PATH);
  return ok(null);
}

export type LogActivityInput = { prospectId: string; kind: "contact" | "follow_up" | "note"; body: string; outcome?: string };

/** Log a contact attempt (with its outcome), a follow-up, or a plain note. */
export async function logActivity(input: LogActivityInput): Promise<ActionResult> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!uuid.test(input.prospectId)) return fail(FAILED);
  const body = trimmed(input.body, 2000);
  if (!body) return fail("Write what happened.", { body: "Write what happened." });
  if (input.kind === "contact" && !trimmed(input.outcome, 500)) {
    return fail("Record the outcome of the contact.", { outcome: "Record the outcome of the contact." });
  }

  const { error } = await (s.db as Loose).from("bd_prospect_activity").insert({
    prospect_id: input.prospectId,
    kind: input.kind,
    body,
    outcome: input.kind === "contact" ? trimmed(input.outcome, 500) : null,
    actor_id: s.actorId,
  });
  if (error) return fail(words(error));

  if (input.kind === "contact") {
    await (s.db as Loose)
      .from("bd_prospects")
      .update({ stage: "contacted" })
      .eq("id", input.prospectId)
      .eq("stage", "new");
  }
  await audit(s, `bd.prospect.${input.kind}_logged`, input.prospectId, {});
  revalidatePath(PATH);
  return ok(null);
}
