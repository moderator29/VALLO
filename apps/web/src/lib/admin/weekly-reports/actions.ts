"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { writeAudit } from "@/lib/admin/audit";
import { doorWords, requireDeskUser } from "@/lib/admin/my-desk/access";
import type { DeskIdentity } from "@/lib/admin/my-desk/model";
import { isNotLive } from "@/lib/features/degrade";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  BUCKET,
  LIMITS,
  UUID_RE,
  canEdit,
  canRemoveProof,
  canReview,
  canSubmit,
  fileProblem,
  parseCaption,
  parseProofLink,
  proofPath,
  submitProblem,
  validateContent,
  type ContentInput,
  type Proof,
  type WeeklyReport,
} from "./model";
import { readReport, REPORT_SELECT, reportFromRow } from "./queries";
import { addDays, dateLabel, formIsOpen, isLateAt, isWeekStart, weekInfo } from "./week";

/**
 * THE WEEKLY REPORT'S WRITES. The door is `requireDeskUser()`: any admin,
 * super admin or staff member with console access. Staff reach the table
 * through the service client the door hands out, which bypasses RLS, so every
 * action here re-checks ownership itself: a person only ever reads or writes
 * a row whose `author_id` is their own, and only a reviewer (admin, super
 * admin or the COO position) touches anyone else's.
 *
 * Inputs are validated before anything is written (`./model.ts`). Files go to
 * the private `staff-report-proofs` bucket under the author's own folder; a
 * link proof must be https.
 */

const NOT_OPEN = "Weekly reports are not set up on this server yet. Ask the lead to apply the pending migration.";
const FAILED = "That did not go through. Try again.";
const MY_PATH = "/admin/my-desk/weekly";
const REVIEW_PATH = "/admin/reports/weekly";

type Actor = { db: SupabaseClient; who: DeskIdentity; reviewer: boolean };

async function actor(): Promise<Actor | { error: string }> {
  const door = await requireDeskUser();
  if (door.state !== "ok") return { error: doorWords(door.state) };
  return { db: door.db, who: door.who, reviewer: canReview(door.who) };
}

function words(error: unknown): string {
  if (isNotLive(error)) return NOT_OPEN;
  if ((error as { code?: string } | null)?.code === "42501") return "Your access does not allow this.";
  return FAILED;
}

async function audit(a: Actor, action: string, entityId: string | null, detail: Record<string, string | number | boolean | null> = {}): Promise<string | null> {
  let written = false;
  try {
    written = await writeAudit(createAdminClient(), { actorId: a.who.userId, action, entityType: "staff_weekly_report", entityId, detail });
  } catch {
    written = false;
  }
  return written ? null : "Done, but the audit line could not be written. Operations has been alerted.";
}

function refresh() {
  revalidatePath(MY_PATH);
  revalidatePath(REVIEW_PATH);
  revalidatePath("/admin/my-desk");
}

function closedWords(week: string): string {
  return `The report for that week opens ${dateLabel(addDays(week, 5))} at midnight, Lagos time.`;
}

/** The caller's own report for a week, or the sentence to refuse with. */
async function mine(a: Actor, week: string): Promise<{ report: WeeklyReport | null } | { error: string }> {
  const read = await readReport(a.db, a.who.userId, week);
  if (read.state === "not-open") return { error: NOT_OPEN };
  if (read.state === "error") return { error: FAILED };
  return { report: read.data };
}

const CONTENT_ROW = (v: { accomplishments: string; numbers: unknown; blockers: string; nextWeek: string }) => ({
  accomplishments: v.accomplishments,
  numbers: v.numbers,
  blockers: v.blockers,
  next_week: v.nextWeek,
});

async function insertDraft(a: Actor, week: string, content: Partial<ReturnType<typeof CONTENT_ROW>> & { status?: string; submitted_at?: string; is_late?: boolean }) {
  return a.db
    .from("staff_weekly_reports")
    .insert({ author_id: a.who.userId, position: a.who.position, week_start: week, status: "draft", ...content })
    .select("id")
    .single();
}

/**
 * Save the typed parts of a report as a draft, as many times as wanted. Before
 * the form has opened this refuses. A submitted report keeps its status when
 * edited; a reviewed one cannot be edited until a reviewer reopens it. Proofs
 * are not touched here (they have their own actions), so a copilot can draft
 * the words without being able to alter the evidence.
 */
export async function saveWeeklyReportDraft(input: ContentInput): Promise<ActionResult<{ id: string; status: string; note: string | null }>> {
  const a = await actor();
  if ("error" in a) return fail(a.error);
  const parsed = validateContent(input);
  if ("error" in parsed) return fail(parsed.error, parsed.fieldErrors);
  const week = parsed.value.weekStart;
  if (!formIsOpen(week)) return fail(closedWords(week));
  const found = await mine(a, week);
  if ("error" in found) return fail(found.error);
  const content = CONTENT_ROW(parsed.value);

  if (!found.report) {
    const { data, error } = await insertDraft(a, week, content);
    if (error || !data) return fail(words(error));
    const id = (data as { id: string }).id;
    const note = await audit(a, "weekly_report.create", id, { week });
    refresh();
    return ok({ id, status: "draft", note });
  }
  if (!canEdit(found.report.status)) return fail("This report has been reviewed. Ask a reviewer to reopen it if it needs a change.");
  const { data, error } = await a.db
    .from("staff_weekly_reports")
    .update(content)
    .eq("id", found.report.id)
    .eq("author_id", a.who.userId)
    .in("status", ["draft", "submitted", "reopened"])
    .select("id");
  if (error) return fail(words(error));
  if (!data || data.length === 0) return fail("This report can no longer be edited.");
  const note = found.report.status === "submitted" ? await audit(a, "weekly_report.edit", found.report.id, { week }) : null;
  refresh();
  return ok({ id: found.report.id, status: found.report.status, note });
}

/** Save and submit in one step. Late (after Monday 12:00 Lagos) is saved and flagged. */
export async function submitWeeklyReport(input: ContentInput): Promise<ActionResult<{ id: string; late: boolean; note: string | null }>> {
  const a = await actor();
  if ("error" in a) return fail(a.error);
  const parsed = validateContent(input);
  if ("error" in parsed) return fail(parsed.error, parsed.fieldErrors);
  const week = parsed.value.weekStart;
  if (!formIsOpen(week)) return fail(closedWords(week));
  const problem = submitProblem(parsed.value);
  if (problem) return fail(problem.error, problem.fieldErrors);
  const found = await mine(a, week);
  if ("error" in found) return fail(found.error);
  const now = new Date();
  const content = CONTENT_ROW(parsed.value);

  if (found.report && !canSubmit(found.report.status)) {
    return fail(found.report.status === "reviewed" ? "This report has been reviewed." : "This report is already submitted. Your changes save to it directly.");
  }
  // A report that was submitted once keeps its original late flag when reopened and sent again.
  const late = found.report?.submittedAt ? found.report.isLate : isLateAt(week, now);
  const sent = { ...content, status: "submitted", submitted_at: now.toISOString(), is_late: late };

  let id: string;
  if (!found.report) {
    const { data, error } = await insertDraft(a, week, sent);
    if (error || !data) return fail(words(error));
    id = (data as { id: string }).id;
  } else {
    const { data, error } = await a.db
      .from("staff_weekly_reports")
      .update(sent)
      .eq("id", found.report.id)
      .eq("author_id", a.who.userId)
      .in("status", ["draft", "reopened"])
      .select("id");
    if (error) return fail(words(error));
    if (!data || data.length === 0) return fail("This report can no longer be submitted.");
    id = found.report.id;
  }
  const note = await audit(a, "weekly_report.submit", id, { week, late });
  refresh();
  return ok({ id, late, note });
}

/** The caller's own report for a week, with whether its form has opened. For the page's twin and the copilot. */
export async function readMyWeeklyReport(week: string): Promise<ActionResult<{ report: WeeklyReport | null; open: boolean; opensAt: string; dueAt: string }>> {
  const a = await actor();
  if ("error" in a) return fail(a.error);
  if (!isWeekStart(week)) return fail("Choose a valid week.");
  const found = await mine(a, week);
  if ("error" in found) return fail(found.error);
  const info = weekInfo(week);
  return ok({ report: found.report, open: formIsOpen(week), opensAt: info.opensAt, dueAt: info.dueAt });
}

// ---------- proof ----------

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** The report a proof is added to: the caller's own, created empty as a draft when it does not exist yet. */
async function reportForProof(a: Actor, week: string): Promise<{ report: WeeklyReport } | { error: string }> {
  if (!isWeekStart(week)) return { error: "Choose a valid week." };
  if (!formIsOpen(week)) return { error: closedWords(week) };
  const found = await mine(a, week);
  if ("error" in found) return found;
  if (found.report) {
    if (!canEdit(found.report.status)) return { error: "This report has been reviewed. Ask a reviewer to reopen it to add proof." };
    return { report: found.report };
  }
  const { data, error } = await insertDraft(a, week, {});
  if (error || !data) return { error: words(error) };
  const again = await mine(a, week);
  if ("error" in again || !again.report) return { error: FAILED };
  return { report: again.report };
}

async function writeProofs(a: Actor, report: WeeklyReport, proofs: Proof[]) {
  return a.db
    .from("staff_weekly_reports")
    .update({ proofs })
    .eq("id", report.id)
    .eq("author_id", a.who.userId)
    .in("status", ["draft", "submitted", "reopened"])
    .select("id");
}

/** Add a link as proof. Only https links are kept. */
export async function addProofLink(week: string, input: { url: string; caption: string }): Promise<ActionResult<{ note: string | null }>> {
  const a = await actor();
  if ("error" in a) return fail(a.error);
  const link = parseProofLink(input?.url);
  if ("error" in link) return fail(link.error, { url: link.error });
  const caption = parseCaption(input?.caption);
  if ("error" in caption) return fail(caption.error, { caption: caption.error });
  const target = await reportForProof(a, week);
  if ("error" in target) return fail(target.error);
  if (target.report.proofs.length >= LIMITS.proofs) return fail(`A report holds up to ${LIMITS.proofs} proofs.`);
  const proof: Proof = { id: newId(), kind: "link", url: link.url, path: null, caption: caption.caption, name: null, contentType: null };
  const { data, error } = await writeProofs(a, target.report, [...target.report.proofs, proof]);
  if (error) return fail(words(error));
  if (!data || data.length === 0) return fail("This report can no longer be edited.");
  const note = await audit(a, "weekly_report.proof_add", target.report.id, { week, kind: "link" });
  refresh();
  return ok({ note });
}

function safeFileName(name: string): string {
  const ext = (name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? "").toLowerCase().slice(0, 8);
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${ext}`;
}

/** Upload one file as proof into the private bucket, under the author's own folder. */
export async function uploadProofFile(formData: FormData): Promise<ActionResult<{ path: string; note: string | null }>> {
  const a = await actor();
  if ("error" in a) return fail(a.error);
  const week = formData.get("week");
  const file = formData.get("file");
  if (typeof week !== "string") return fail("Choose a valid week.");
  if (!(file instanceof File)) return fail("Choose a file.");
  const problem = fileProblem(file);
  if (problem) return fail(problem);
  const caption = parseCaption(formData.get("caption"));
  if ("error" in caption) return fail(caption.error, { caption: caption.error });
  const target = await reportForProof(a, week);
  if ("error" in target) return fail(target.error);
  if (target.report.proofs.length >= LIMITS.proofs) return fail(`A report holds up to ${LIMITS.proofs} proofs.`);

  const path = proofPath(a.who.userId, week, safeFileName(file.name || "proof"));
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await a.db.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) {
    const message = (uploadError as { message?: string } | null)?.message ?? "";
    if (/not found|bucket/i.test(message)) return fail(NOT_OPEN);
    return fail("The upload did not go through. Try again.");
  }
  const proof: Proof = {
    id: newId(),
    kind: "file",
    url: null,
    path,
    caption: caption.caption,
    name: (file.name || "proof").slice(0, 120),
    contentType: file.type,
  };
  const { data, error } = await writeProofs(a, target.report, [...target.report.proofs, proof]);
  if (error || !data || data.length === 0) {
    // The report would not take the proof, so do not leave an orphan file behind.
    await a.db.storage.from(BUCKET).remove([path]);
    return fail(error ? words(error) : "This report can no longer be edited.");
  }
  const note = await audit(a, "weekly_report.proof_add", target.report.id, { week, kind: "file", contentType: file.type, bytes: file.size });
  refresh();
  return ok({ path, note });
}

/** Remove a proof. Only while the report is a draft or has been reopened. */
export async function removeProof(week: string, proofId: string): Promise<ActionResult<{ note: string | null }>> {
  const a = await actor();
  if ("error" in a) return fail(a.error);
  if (!isWeekStart(week)) return fail("Choose a valid week.");
  if (typeof proofId !== "string" || !/^[A-Za-z0-9_-]{4,40}$/.test(proofId)) return fail(FAILED);
  const found = await mine(a, week);
  if ("error" in found) return fail(found.error);
  if (!found.report) return fail("There is no report for that week.");
  if (!canRemoveProof(found.report.status)) return fail("Proof can be removed only while the report is a draft or has been reopened.");
  const proof = found.report.proofs.find((p) => p.id === proofId);
  if (!proof) return fail("That proof is already gone.");
  const { data, error } = await a.db
    .from("staff_weekly_reports")
    .update({ proofs: found.report.proofs.filter((p) => p.id !== proofId) })
    .eq("id", found.report.id)
    .eq("author_id", a.who.userId)
    .in("status", ["draft", "reopened"])
    .select("id");
  if (error) return fail(words(error));
  if (!data || data.length === 0) return fail("Proof can be removed only while the report is a draft or has been reopened.");
  if (proof.kind === "file" && proof.path) await a.db.storage.from(BUCKET).remove([proof.path]);
  const note = await audit(a, "weekly_report.proof_remove", found.report.id, { week, kind: proof.kind });
  refresh();
  return ok({ note });
}

// ---------- reviewer ----------

async function reportToReview(a: Actor, id: string): Promise<{ report: WeeklyReport } | { error: string }> {
  if (!a.reviewer) return { error: "Only admins, super admins and the COO review weekly reports." };
  if (typeof id !== "string" || !UUID_RE.test(id)) return { error: FAILED };
  const { data, error } = await a.db.from("staff_weekly_reports").select(REPORT_SELECT).eq("id", id).maybeSingle();
  if (error) return { error: words(error) };
  if (!data) return { error: "That report no longer exists." };
  return { report: reportFromRow(data as never) };
}

/** Mark a submitted report reviewed, with an optional note the author reads. Not your own report. */
export async function reviewReport(id: string, note: string): Promise<ActionResult<{ note: string | null }>> {
  const a = await actor();
  if ("error" in a) return fail(a.error);
  const found = await reportToReview(a, id);
  if ("error" in found) return fail(found.error);
  const text = typeof note === "string" ? note.trim() : "";
  if (text.length > LIMITS.reviewNote) return fail(`Keep the note under ${LIMITS.reviewNote} characters.`, { note: "Shorten it." });
  if (found.report.authorId === a.who.userId) return fail("Another reviewer needs to review your own report.");
  if (found.report.status !== "submitted") return fail("Only a submitted report can be marked reviewed.");
  const { data, error } = await a.db
    .from("staff_weekly_reports")
    .update({ status: "reviewed", reviewed_by: a.who.userId, reviewed_at: new Date().toISOString(), review_note: text || null })
    .eq("id", id)
    .eq("status", "submitted")
    .select("id");
  if (error) return fail(words(error));
  if (!data || data.length === 0) return fail("Only a submitted report can be marked reviewed.");
  const audited = await audit(a, "weekly_report.review", id, { week: found.report.weekStart });
  refresh();
  return ok({ note: audited });
}

/** Send a submitted or reviewed report back to its author to change, with the reason they will read. */
export async function reopenReport(id: string, reason: string): Promise<ActionResult<{ note: string | null }>> {
  const a = await actor();
  if ("error" in a) return fail(a.error);
  const found = await reportToReview(a, id);
  if ("error" in found) return fail(found.error);
  const text = typeof reason === "string" ? reason.trim() : "";
  if (text.length < 5) return fail("Give a reason of at least five characters.", { note: "Say what to change." });
  if (text.length > LIMITS.reviewNote) return fail(`Keep the reason under ${LIMITS.reviewNote} characters.`, { note: "Shorten it." });
  if (found.report.status !== "submitted" && found.report.status !== "reviewed") return fail("Only a submitted or reviewed report can be reopened.");
  const { data, error } = await a.db
    .from("staff_weekly_reports")
    .update({ status: "reopened", reviewed_by: null, reviewed_at: null, review_note: text })
    .eq("id", id)
    .in("status", ["submitted", "reviewed"])
    .select("id");
  if (error) return fail(words(error));
  if (!data || data.length === 0) return fail("Only a submitted or reviewed report can be reopened.");
  const audited = await audit(a, "weekly_report.reopen", id, { week: found.report.weekStart, reason: text.slice(0, 200) });
  refresh();
  return ok({ note: audited });
}
