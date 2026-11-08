"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { requireConsole } from "@/lib/admin/guard";
import { isNotLive } from "@/lib/features/degrade";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * TRUST AND SAFETY, THE WRITES. Each one calls a database function on the
 * staff member's OWN session: the function checks the scope
 * (`private.case_can`), writes the case timeline and the audit log, and tells
 * the member when it should. The only service-role steps are storage (the
 * evidence bucket has no member policy) and they run AFTER the database has
 * said yes to this person for this case. Hiding a button is never the check.
 */

type Db = SupabaseClient;
const FAILED = "That did not go through. Try again.";
const NOT_OPEN = "Trust and Safety is not open on this server yet.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function staff(): Promise<{ db: Db; userId: string } | { error: string }> {
  const access = await requireConsole();
  if (access.state === "unconfigured") return { error: NOT_OPEN };
  if (access.state === "signed-out") return { error: "Sign in to continue." };
  if (access.state === "step-up") return { error: "Confirm your security key to use the console." };
  if (access.state !== "console") return { error: "This is for Vallo staff." };
  return { db: access.supabase as unknown as Db, userId: access.user.id };
}

function words(error: { code?: string; message?: string } | null): string {
  if (!error) return FAILED;
  if (isNotLive(error)) return NOT_OPEN;
  if (error.code === "42501") return "Your staff role does not allow this.";
  if (typeof error.code === "string" && /^RM\d{3}$/.test(error.code) && error.message) return error.message;
  return FAILED;
}

async function rpc<T = null>(fn: string, args: Record<string, unknown>, paths: string[]): Promise<ActionResult<T>> {
  const who = await staff();
  if ("error" in who) return fail(who.error);
  const { data, error } = await who.db.rpc(fn, args);
  if (error) return fail(words(error));
  for (const p of paths) revalidatePath(p);
  return ok((data ?? null) as T);
}

const caseRefresh = (id: string) => [`/admin/cases/${id}`, "/admin/cases", "/admin/trust"];

export async function assignCase(input: { caseId: string; to?: string | null }): Promise<ActionResult> {
  if (!UUID.test(input.caseId) || (input.to && !UUID.test(input.to))) return fail(FAILED);
  return rpc("admin_case_assign", { p_id: input.caseId, p_to: input.to ?? null }, caseRefresh(input.caseId));
}

export async function addCaseNote(input: { caseId: string; body: string }): Promise<ActionResult> {
  if (!UUID.test(input.caseId)) return fail(FAILED);
  const body = (input.body ?? "").trim();
  if (body.length < 2) return fail("Write the note first.", { body: "Write the note first." });
  if (body.length > 4000) return fail("Keep the note to 4,000 characters.");
  return rpc("admin_case_note", { p_id: input.caseId, p_body: body }, caseRefresh(input.caseId));
}

export async function setCaseStatus(input: { caseId: string; status: "under_review" | "awaiting_info"; note?: string }): Promise<ActionResult> {
  if (!UUID.test(input.caseId)) return fail(FAILED);
  return rpc("admin_case_set_status", { p_id: input.caseId, p_status: input.status, p_note: input.note ?? null }, caseRefresh(input.caseId));
}

export async function escalateCase(input: { caseId: string; reason: string }): Promise<ActionResult> {
  if (!UUID.test(input.caseId)) return fail(FAILED);
  return rpc("admin_case_escalate", { p_id: input.caseId, p_reason: (input.reason ?? "").trim() }, caseRefresh(input.caseId));
}

export async function messageCaseMember(input: { caseId: string; to: string; body: string }): Promise<ActionResult> {
  if (!UUID.test(input.caseId) || !UUID.test(input.to)) return fail(FAILED);
  return rpc("admin_case_message", { p_id: input.caseId, p_to: input.to, p_body: (input.body ?? "").trim() }, caseRefresh(input.caseId));
}

export async function actOnCase(input: { caseId: string; action: string; reason: string }): Promise<ActionResult> {
  if (!UUID.test(input.caseId)) return fail(FAILED);
  return rpc("admin_case_act", { p_id: input.caseId, p_action: input.action, p_reason: (input.reason ?? "").trim() }, caseRefresh(input.caseId));
}

export async function resolveCase(input: { caseId: string; resolution: string; note: string; tellReporters: boolean }): Promise<ActionResult> {
  if (!UUID.test(input.caseId)) return fail(FAILED);
  return rpc(
    "admin_case_resolve",
    { p_id: input.caseId, p_resolution: input.resolution, p_note: (input.note ?? "").trim(), p_tell_reporters: Boolean(input.tellReporters) },
    caseRefresh(input.caseId),
  );
}

export async function closeCase(input: { caseId: string; note?: string }): Promise<ActionResult> {
  if (!UUID.test(input.caseId)) return fail(FAILED);
  return rpc("admin_case_close", { p_id: input.caseId, p_note: input.note ?? null }, caseRefresh(input.caseId));
}

export async function reopenCase(input: { caseId: string; reason: string }): Promise<ActionResult> {
  if (!UUID.test(input.caseId)) return fail(FAILED);
  return rpc("admin_case_reopen", { p_id: input.caseId, p_reason: (input.reason ?? "").trim() }, caseRefresh(input.caseId));
}

export async function restrictMember(input: { userId: string; kind: string; days: number | null; reason: string; caseId?: string | null }): Promise<ActionResult<string>> {
  if (!UUID.test(input.userId) || (input.caseId && !UUID.test(input.caseId))) return fail(FAILED);
  const days = input.days === null ? null : Math.max(1, Math.min(3650, Math.round(Number(input.days))));
  return rpc<string>(
    "admin_restrict_member",
    { p_user: input.userId, p_kind: input.kind, p_days: days, p_reason: (input.reason ?? "").trim(), p_case: input.caseId ?? null },
    input.caseId ? caseRefresh(input.caseId) : ["/admin/trust", `/admin/people/${input.userId}`],
  );
}

export async function liftRestriction(input: { restrictionId: string; reason: string; caseId?: string | null }): Promise<ActionResult> {
  if (!UUID.test(input.restrictionId)) return fail(FAILED);
  return rpc("admin_lift_restriction", { p_id: input.restrictionId, p_reason: (input.reason ?? "").trim() }, input.caseId ? caseRefresh(input.caseId) : ["/admin/trust"]);
}

export async function decideAppeal(input: { appealId: string; overturn: boolean; note: string }): Promise<ActionResult> {
  if (!UUID.test(input.appealId)) return fail(FAILED);
  return rpc("admin_decide_appeal", { p_id: input.appealId, p_overturn: Boolean(input.overturn), p_note: (input.note ?? "").trim() }, ["/admin/appeals", "/admin/trust"]);
}

/* ------------------------------------------------------------------ module desks */

export async function actOnRoommates(input: { targetType: "roommate_listing" | "roommate_profile" | "roommate_group"; targetId: string; action: string; reason: string }): Promise<ActionResult> {
  if (!UUID.test(input.targetId)) return fail(FAILED);
  return rpc("admin_roommate_act", { p_target_type: input.targetType, p_target: input.targetId, p_action: input.action, p_reason: (input.reason ?? "").trim() }, ["/admin/roommates"]);
}

export async function decideRoommateVerification(input: { id: string; decision: "approve" | "reject" | "more_info"; reason?: string }): Promise<ActionResult> {
  if (!UUID.test(input.id)) return fail(FAILED);
  return rpc("admin_roommate_decide_verification", { p_id: input.id, p_decision: input.decision, p_reason: input.reason ?? null }, ["/admin/roommates"]);
}

export async function actOnCommunity(input: { communityId: string; action: "pause" | "remove" | "restore"; reason: string }): Promise<ActionResult> {
  if (!UUID.test(input.communityId)) return fail(FAILED);
  return rpc("admin_circle_act", { p_community: input.communityId, p_action: input.action, p_reason: (input.reason ?? "").trim() }, ["/admin/circle"]);
}

/* ------------------------------------------------------------------ files */

/**
 * A five minute link to one piece of case evidence. The database first says
 * whether this person may see the case at all; only then does the service
 * client sign the private file.
 */
export async function caseEvidenceLink(input: { caseId: string; evidenceId: string }): Promise<ActionResult<string>> {
  const who = await staff();
  if ("error" in who) return fail(who.error);
  if (!UUID.test(input.caseId) || !UUID.test(input.evidenceId)) return fail(FAILED);
  const { data: view, error } = await who.db.rpc("admin_case_view", { p_id: input.caseId });
  if (error || !view) return fail("You cannot open this case.");
  const ev = ((view as { evidence?: { id: string; path: string }[] }).evidence ?? []).find((e) => e.id === input.evidenceId);
  if (!ev) return fail("That file is not on this case.");
  const admin = createAdminClient() as unknown as Db;
  const { data: signed, error: signErr } = await admin.storage.from("moderation-evidence").createSignedUrl(ev.path, 300);
  if (signErr || !signed?.signedUrl) return fail("The file could not be opened.");
  return ok(signed.signedUrl);
}

/** Add a file to a case: the database says yes first, then the file is stored privately. */
export async function addCaseEvidence(formData: FormData): Promise<ActionResult<string>> {
  const who = await staff();
  if ("error" in who) return fail(who.error);
  const caseId = String(formData.get("caseId") ?? "");
  const note = String(formData.get("note") ?? "").slice(0, 500);
  const file = formData.get("file");
  if (!UUID.test(caseId) || !(file instanceof File)) return fail("Choose a file.");
  if (file.size > 15 * 1024 * 1024) return fail("Files up to 15 MB.");
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  if (!["jpg", "jpeg", "png", "webp", "pdf", "mp4"].includes(ext)) return fail("Use a photo, a PDF or a short video.");
  const { data: view, error } = await who.db.rpc("admin_case_view", { p_id: caseId });
  const can = (view as { can?: { note?: boolean } } | null)?.can;
  if (error || !view || !can?.note) return fail("Your staff role does not allow this.");
  const path = `cases/${caseId}/${crypto.randomUUID()}.${ext}`;
  const admin = createAdminClient() as unknown as Db;
  const { error: upErr } = await admin.storage.from("moderation-evidence").upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) return fail("The file could not be stored. Try again.");
  const { data: id, error: recErr } = await who.db.rpc("admin_case_add_evidence", { p_id: caseId, p_path: path, p_note: note || null });
  if (recErr) {
    await admin.storage.from("moderation-evidence").remove([path]);
    return fail(words(recErr));
  }
  revalidatePath(`/admin/cases/${caseId}`);
  return ok(String(id));
}

/**
 * A five minute link to a member's verification document, for verification
 * staff only. The list read refuses anyone without the documents permission;
 * every opening is written to the audit log.
 */
export async function verificationDocumentLink(input: { id: string }): Promise<ActionResult<string>> {
  const who = await staff();
  if ("error" in who) return fail(who.error);
  if (!UUID.test(input.id)) return fail(FAILED);
  const { error: permErr } = await who.db.rpc("admin_roommate_verifications", { p_status: "review" });
  if (permErr) return fail(words(permErr));
  const admin = createAdminClient() as unknown as Db;
  const { data: row } = await admin.from("roommate_verifications").select("evidence_path, user_id").eq("id", input.id).maybeSingle();
  const r = row as { evidence_path: string | null; user_id: string } | null;
  if (!r?.evidence_path) return fail("There is no document on this check.");
  if (r.user_id === who.userId) return fail("You cannot open your own verification.");
  const { data: signed, error } = await admin.storage.from("roommate-evidence").createSignedUrl(r.evidence_path, 300);
  if (error || !signed?.signedUrl) return fail("The document could not be opened.");
  await admin.from("audit_log").insert({ actor_id: who.userId, action: "roommates.verification.document_viewed", entity_type: "roommate_verification", entity_id: input.id, metadata: {} });
  return ok(signed.signedUrl);
}
