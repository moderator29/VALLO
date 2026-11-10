"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, validate, type ActionResult } from "@/lib/actions/envelope";
import { requireConsole } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { isNotLive } from "@/lib/features/degrade";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * THE ROOMMATES DESK'S OWN WRITES (FE-B): the schools directory and the
 * matching weights. Posts, profiles, groups and checks are decided through
 * the Trust and Safety layer (`lib/admin/cases/actions.ts`), which the lead
 * owns. These run on the staff member's OWN session, so the database's
 * staff policies (`private.is_staff()` on `institutions` and
 * `roommate_match_weights`) decide who may write; only the audit line is
 * written with the service role, because `audit_log` has no member insert
 * policy. A table that is not there yet answers with the honest sentence.
 */

const NOT_OPEN = "Vallo Roommates is not open on this server yet.";
const FAILED = "That did not go through. Try again.";
const PATH = "/admin/roommates";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Staff = { db: SupabaseClient; actorId: string };

async function staff(): Promise<Staff | { error: string }> {
  const access = await requireConsole();
  if (access.state === "unconfigured") return { error: "The console is not configured on this server." };
  if (access.state === "signed-out") return { error: "Sign in with your operations account to continue." };
  if (access.state === "step-up") return { error: "Confirm your security key to use the console." };
  if (access.state !== "console") return { error: "This is for Vallo staff." };
  return { db: access.supabase as unknown as SupabaseClient, actorId: access.user.id };
}

function words(error: unknown): string {
  if (isNotLive(error)) return NOT_OPEN;
  if ((error as { code?: string } | null)?.code === "42501") return "Your staff role does not allow this.";
  return FAILED;
}

/** Zero rows changed under RLS means the policy refused: say so rather than claim it. */
function refused(data: unknown[] | null): boolean {
  return !data || data.length === 0;
}

async function audit(s: Staff, action: string, entityType: string, entityId: string | null, detail: Record<string, string | number | boolean | null> = {}): Promise<string | null> {
  let written = false;
  try {
    written = await writeAudit(createAdminClient(), { actorId: s.actorId, action, entityType, entityId, detail });
  } catch {
    written = false;
  }
  return written ? null : "Done, but the audit line could not be written. Operations has been alerted.";
}

/** Turn the school email check on or off for one institution. */
export async function setInstitutionEmailCheck(input: { id: string; on: boolean }): Promise<ActionResult<{ note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!uuid.test(input.id)) return fail(FAILED);
  const { data, error } = await s.db.from("institutions").update({ email_verify_on: Boolean(input.on) }).eq("id", input.id).select("id");
  if (error) return fail(words(error));
  if (refused(data)) return fail("Your staff role does not allow this.");
  const note = await audit(s, "roommates.institution.email_check", "institution", input.id, { on: Boolean(input.on) });
  revalidatePath(PATH);
  return ok({ note });
}

const domainShape = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function readDomains(raw: string): string[] | null {
  const list = raw
    .split(/[\s,]+/)
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  if (list.some((d) => !domainShape.test(d) || d.length > 80)) return null;
  return [...new Set(list)].slice(0, 10);
}

/** Replace an institution's email domains (checked against its own website before saving). */
export async function setInstitutionDomains(input: { id: string; domains: string }): Promise<ActionResult<{ note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!uuid.test(input.id)) return fail(FAILED);
  const domains = readDomains(input.domains ?? "");
  if (!domains) return fail("One of those is not an email domain. Write them like unilag.edu.ng, separated by commas.", { domains: "Check the domains." });
  const { data, error } = await s.db.from("institutions").update({ email_domains: domains, ...(domains.length === 0 ? { email_verify_on: false } : {}) }).eq("id", input.id).select("id");
  if (error) return fail(words(error));
  if (refused(data)) return fail("Your staff role does not allow this.");
  const note = await audit(s, "roommates.institution.domains", "institution", input.id, { domains: domains.join(",") });
  revalidatePath(PATH);
  return ok({ note });
}

const KINDS = ["university", "polytechnic", "college", "other"] as const;

/** Add an institution to the directory. */
export async function addInstitution(input: { name: string; shortName: string; kind: string; stateCode: string; city: string; domains: string }): Promise<ActionResult<{ id: string; note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  const name = (input.name ?? "").trim();
  if (name.length < 3 || name.length > 140) return fail("Give the school's full name.", { name: "Give the full name." });
  const kind = (KINDS as readonly string[]).includes(input.kind) ? input.kind : null;
  if (!kind) return fail("Choose what kind of school it is.", { kind: "Choose one." });
  const shortName = (input.shortName ?? "").trim().slice(0, 30) || null;
  const stateCode = /^[A-Z]{2}$/.test((input.stateCode ?? "").trim().toUpperCase()) ? input.stateCode.trim().toUpperCase() : null;
  const domains = readDomains(input.domains ?? "");
  if (!domains) return fail("One of those is not an email domain. Write them like unilag.edu.ng, separated by commas.", { domains: "Check the domains." });
  const slug = `${(shortName ?? name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70)}`;
  if (slug.length < 2) return fail("Give the school's full name.", { name: "Give the full name." });
  const { data, error } = await s.db
    .from("institutions")
    .insert({ name, short_name: shortName, kind, state_code: stateCode, city: (input.city ?? "").trim().slice(0, 80) || null, email_domains: domains, email_verify_on: false, slug })
    .select("id")
    .single();
  if (error || !data) {
    if ((error as { code?: string } | null)?.code === "23505") return fail("A school with that address already exists.");
    return fail(words(error));
  }
  const id = (data as { id: string }).id;
  const note = await audit(s, "roommates.institution.add", "institution", id, { name, slug });
  revalidatePath(PATH);
  return ok({ id, note });
}

const PARTS = ["budget", "location", "move_in", "lifestyle", "accommodation"] as const;

/** The matching weights, one row. Each part 0 to 100. */
export async function saveMatchWeights(input: Record<(typeof PARTS)[number], number>): Promise<ActionResult<{ note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  const row: Record<string, number> = {};
  for (const p of PARTS) {
    const n = Math.round(Number(input[p]));
    if (!Number.isFinite(n) || n < 0 || n > 100) return fail("Each weight is a whole number from 0 to 100.", { [p]: "0 to 100." });
    row[p] = n;
  }
  if (Object.values(row).every((n) => n === 0)) return fail("At least one weight must be above 0.");
  const { data, error } = await s.db.from("roommate_match_weights").update({ ...row, updated_at: new Date().toISOString() }).eq("id", true).select("id");
  if (error) return fail(words(error));
  if (refused(data)) return fail("Your staff role does not allow this.");
  const note = await audit(s, "roommates.weights.save", "roommate_match_weights", null, row);
  revalidatePath(PATH);
  return ok({ note });
}

/* ------------------------------------------------------------------ the room offer review */

const reviewSchema = z.object({
  id: z.string().regex(uuid),
  decision: z.enum(["claim", "approve", "changes", "reject"]),
  note: z.string().trim().max(1000),
});

const DECISION_AUDIT: Record<"claim" | "approve" | "changes" | "reject", string> = {
  claim: "roommates.review.claim",
  approve: "roommates.review.approve",
  changes: "roommates.review.changes",
  reject: "roommates.review.reject",
};

/**
 * Decide a room offer waiting for review: pick it up, approve it (it goes live
 * in the Roommates feed), ask for changes or turn it down. The reason is
 * required for changes and for a refusal because the owner reads it. One
 * database function does the change and writes the audit line in the same
 * transaction (`admin_roommate_review_decide`); the app only checks the
 * sentence first, so a mistake is caught before the round trip.
 */
export async function decideRoomOffer(input: { id: string; decision: "claim" | "approve" | "changes" | "reject"; note?: string }): Promise<ActionResult<{ status: string; note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  const parsed = validate(reviewSchema, { id: input.id, decision: input.decision, note: input.note ?? "" });
  if (!parsed.ok) return fail(FAILED);
  const { id, decision, note } = parsed.data;
  if ((decision === "changes" || decision === "reject") && note.length < 5) {
    return fail(decision === "changes" ? "Tell the owner what to fix, at least five characters." : "Say why it is not approved, at least five characters.", { note: "At least five characters." });
  }
  const { data, error } = await s.db.rpc("admin_roommate_review_decide", { p_id: id, p_decision: decision, p_note: note || null });
  if (error) {
    const e = error as { code?: string; message?: string };
    if (typeof e.code === "string" && /^RM\d{3}$/.test(e.code) && e.message) return fail(e.message);
    return fail(words(error));
  }
  revalidatePath(PATH);
  revalidatePath("/roommates");
  revalidatePath(`/roommates/r/${id}`);
  return ok({ status: typeof data === "string" ? data : DECISION_AUDIT[decision], note: null });
}
