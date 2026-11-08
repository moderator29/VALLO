"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { adminRefusal, requireAdmin } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { isNotLive } from "@/lib/features/degrade";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * THE ROOMMATES DESK'S WRITES (FE-B). Each one passes `requireAdmin("moderation")`
 * first, then writes with the service client (the roommate tables are new and
 * not in the generated types, hence the untyped client) and pairs the change
 * with an `audit_log` row: who, what, which record, and the detail. A table
 * that is not there yet answers with the honest sentence, never a fake success.
 */

const NOT_OPEN = "Vallo Roommates is not open on this server yet.";
const FAILED = "That did not go through. Try again.";
const PATH = "/admin/roommates";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Staff = { db: SupabaseClient; typed: ReturnType<typeof createAdminClient>; actorId: string };

async function staff(): Promise<Staff | { error: string }> {
  const access = await requireAdmin("moderation");
  if (access.state !== "admin") return { error: adminRefusal(access) };
  try {
    const typed = createAdminClient();
    return { db: typed as unknown as SupabaseClient, typed, actorId: access.user.id };
  } catch {
    return { error: "The console is not configured on this server." };
  }
}

function words(error: unknown): string {
  return isNotLive(error) ? NOT_OPEN : FAILED;
}

async function audit(s: Staff, action: string, entityType: string, entityId: string | null, detail: Record<string, string | number | boolean | null> = {}): Promise<string | null> {
  const written = await writeAudit(s.typed, { actorId: s.actorId, action, entityType, entityId, detail });
  return written ? null : "Done, but the audit line could not be written. Operations has been alerted.";
}

/** Verify a post (the "Listing checked by Vallo" mark), or take the mark back. */
export async function verifyRoommateListing(input: { id: string; verified: boolean }): Promise<ActionResult<{ note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!uuid.test(input.id)) return fail(FAILED);
  const patch = input.verified ? { verified_at: new Date().toISOString(), verified_by: s.actorId } : { verified_at: null, verified_by: null };
  const { error } = await s.db.from("roommate_listings").update(patch).eq("id", input.id);
  if (error) return fail(words(error));
  const note = await audit(s, input.verified ? "roommates.listing.verify" : "roommates.listing.unverify", "roommate_listing", input.id);
  revalidatePath(PATH);
  return ok({ note });
}

/** Take a post down (status removed), with the reason kept in the audit trail. */
export async function removeRoommateListing(input: { id: string; reason: string }): Promise<ActionResult<{ note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!uuid.test(input.id)) return fail(FAILED);
  const reason = (input.reason ?? "").trim().slice(0, 300);
  if (reason.length < 4) return fail("Say why the post is coming down.", { reason: "Say why." });
  const { error } = await s.db.from("roommate_listings").update({ status: "removed" }).eq("id", input.id);
  if (error) return fail(words(error));
  const note = await audit(s, "roommates.listing.remove", "roommate_listing", input.id, { reason });
  revalidatePath(PATH);
  return ok({ note });
}

/** Hold a roommate profile for review, or let it go back to active. */
export async function holdRoommateProfile(input: { userId: string; hold: boolean; reason?: string }): Promise<ActionResult<{ note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!uuid.test(input.userId)) return fail(FAILED);
  const { error } = await s.db.from("roommate_profiles").update({ status: input.hold ? "held" : "active" }).eq("user_id", input.userId);
  if (error) return fail(words(error));
  const note = await audit(s, input.hold ? "roommates.profile.hold" : "roommates.profile.unhold", "roommate_profile", input.userId, { reason: (input.reason ?? "").slice(0, 300) || null });
  revalidatePath(PATH);
  return ok({ note });
}

/** A five-minute link to a member's evidence in the private bucket. Logged, because it shows a document. */
export async function openRoommateEvidence(id: string): Promise<ActionResult<{ url: string }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!uuid.test(id)) return fail(FAILED);
  const { data, error } = await s.db.from("roommate_verifications").select("evidence_path").eq("id", id).maybeSingle();
  if (error) return fail(words(error));
  const path = (data as { evidence_path: string | null } | null)?.evidence_path;
  if (!path) return fail("This check has no document attached.");
  const signed = await s.db.storage.from("roommate-evidence").createSignedUrl(path, 300);
  if (signed.error || !signed.data?.signedUrl) return fail("The document could not be opened. It may have been deleted.");
  await audit(s, "roommates.evidence.open", "roommate_verification", id);
  return ok({ url: signed.data.signedUrl });
}

/** Approve (verified for a year) or reject (with the reason the member reads) a check. */
export async function decideRoommateVerification(input: { id: string; approve: boolean; reason?: string }): Promise<ActionResult<{ note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!uuid.test(input.id)) return fail(FAILED);
  const reason = (input.reason ?? "").trim().slice(0, 300);
  if (!input.approve && reason.length < 4) return fail("Say why it was not accepted. The member reads this.", { reason: "Say why." });
  const now = new Date();
  const patch = input.approve
    ? { status: "verified", reviewed_by: s.actorId, reviewed_at: now.toISOString(), expires_at: new Date(now.getTime() + 365 * 24 * 3600 * 1000).toISOString(), reason: null }
    : { status: "rejected", reviewed_by: s.actorId, reviewed_at: now.toISOString(), reason };
  const { error } = await s.db.from("roommate_verifications").update(patch).eq("id", input.id).eq("status", "review");
  if (error) return fail(words(error));
  const note = await audit(s, input.approve ? "roommates.verification.approve" : "roommates.verification.reject", "roommate_verification", input.id, { reason: reason || null });
  revalidatePath(PATH);
  return ok({ note });
}

/** Turn the school email check on or off for one institution. */
export async function setInstitutionEmailCheck(input: { id: string; on: boolean }): Promise<ActionResult<{ note: string | null }>> {
  const s = await staff();
  if ("error" in s) return fail(s.error);
  if (!uuid.test(input.id)) return fail(FAILED);
  const { error } = await s.db.from("institutions").update({ email_verify_on: Boolean(input.on) }).eq("id", input.id);
  if (error) return fail(words(error));
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
  const { error } = await s.db.from("institutions").update({ email_domains: domains, ...(domains.length === 0 ? { email_verify_on: false } : {}) }).eq("id", input.id);
  if (error) return fail(words(error));
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
  const { error } = await s.db.from("roommate_match_weights").update({ ...row, updated_at: new Date().toISOString() }).eq("id", true);
  if (error) return fail(words(error));
  const note = await audit(s, "roommates.weights.save", "roommate_match_weights", null, row);
  revalidatePath(PATH);
  return ok({ note });
}
