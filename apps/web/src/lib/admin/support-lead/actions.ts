"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { requireAdmin } from "@/lib/admin/guard";
import { auditDesk, deskDoor, deskRefusal, deskWords, type DeskDoor } from "@/lib/admin/desk-door";
import { isUuid, reasonProblem, trimmed } from "@/lib/admin/desk-rules";

import { parsePolicy, parseQa, type PolicyInput, type QaInput } from "./model";

/**
 * THE CUSTOMER SUPPORT LEAD'S WRITES: quality reviews, policy notes and
 * handing a ticket to a colleague. Every export re-checks the door
 * (`requireAdmin("support_lead")`, plus the COO as an approver of policy),
 * validates before any write, guards each move on the status it read, and
 * writes an audit line. A review stores the ticket's reference and four
 * scores, never a word of the conversation. Nothing here messages a member.
 */

const NOT_OPEN = "The support lead tables are not set up on this server yet. Ask the lead to apply the pending migration.";
const PATH = "/admin/support-lead";

type Ctx = Extract<DeskDoor, { state: "ok" }>;
type Gate = { ctx: Ctx } | { error: string };
type Done = ActionResult<{ note: string | null }>;

async function maker(): Promise<Gate> {
  const door = await deskDoor("support_lead", { approverMayEnter: true });
  if (door.state !== "ok") return { error: deskRefusal(door.state) };
  if (door.viaApprover) return { error: "Only the Customer Support Lead or an admin can change this. You can approve a policy note." };
  return { ctx: door };
}
async function approver(): Promise<Gate> {
  const door = await deskDoor("support_lead", { approverMayEnter: true });
  if (door.state !== "ok") return { error: deskRefusal(door.state) };
  if (!door.canApprove) return { error: "Only the COO or an admin approves a policy note." };
  return { ctx: door };
}

async function isSupportAgent(db: SupabaseClient, userId: string): Promise<boolean | "error"> {
  const { data, error } = await db.from("staff_grants").select("user_id").eq("user_id", userId).is("revoked_at", null).contains("scopes", ["support"]).maybeSingle();
  if (error) return "error";
  return !!data;
}

export async function createQaReview(input: QaInput): Promise<ActionResult<{ id: string; note: string | null }>> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  const parsed = parseQa(input);
  if ("error" in parsed) return fail(parsed.error, parsed.fieldErrors);
  const agent = await isSupportAgent(g.ctx.db, parsed.value.reviewed_agent);
  if (agent === "error") return fail(deskWords({}, NOT_OPEN));
  if (!agent) return fail("Choose a member of the support team from the list.", { agentId: "Choose one." });
  if (parsed.value.reviewed_agent === g.ctx.user.id) return fail("Review a colleague's answer, not your own.", { agentId: "Choose a colleague." });
  const { data, error } = await g.ctx.db.from("support_qa_reviews").insert({ ...parsed.value, reviewer_id: g.ctx.user.id }).select("id").single();
  if (error || !data) return fail(deskWords(error, NOT_OPEN));
  const id = (data as { id: string }).id;
  const note = await auditDesk(g.ctx.user.id, "support_qa_review", "support_lead.qa.create", id, { ticket: parsed.value.ticket_ref });
  revalidatePath(PATH);
  return ok({ id, note });
}

export async function createPolicyNote(input: PolicyInput): Promise<ActionResult<{ id: string; note: string | null }>> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  const parsed = parsePolicy(input);
  if ("error" in parsed) return fail(parsed.error, parsed.fieldErrors);
  const { data, error } = await g.ctx.db.from("support_policy_notes").insert({ ...parsed.value, status: "draft", created_by: g.ctx.user.id }).select("id").single();
  if (error || !data) return fail(deskWords(error, NOT_OPEN));
  const id = (data as { id: string }).id;
  const note = await auditDesk(g.ctx.user.id, "support_policy_note", "support_lead.policy.create", id);
  revalidatePath(PATH);
  return ok({ id, note });
}

type PolicyRow = { id: string; status: string; created_by: string | null };
async function loadPolicy(db: SupabaseClient, id: string): Promise<{ row: PolicyRow } | { error: string }> {
  const { data, error } = await db.from("support_policy_notes").select("id, status, created_by").eq("id", id).maybeSingle();
  if (error) return { error: deskWords(error, NOT_OPEN) };
  if (!data) return { error: "That note could not be found." };
  return { row: data as unknown as PolicyRow };
}

async function movePolicy(ctx: Ctx, id: string, from: string, patch: Record<string, unknown>, action: string): Promise<Done> {
  const { data, error } = await ctx.db.from("support_policy_notes").update(patch).eq("id", id).eq("status", from).select("id");
  if (error) return fail(deskWords(error, NOT_OPEN));
  if (!data || data.length === 0) return fail("That note has changed since you opened it. Refresh and try again.");
  const note = await auditDesk(ctx.user.id, "support_policy_note", action, id, { from });
  revalidatePath(PATH);
  return ok({ note });
}

/** Edits a draft. An approved note goes back to draft first, so the team never works from an unapproved edit. */
export async function updatePolicyNote(id: string, input: PolicyInput): Promise<Done> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That note could not be found.");
  const parsed = parsePolicy(input);
  if ("error" in parsed) return fail(parsed.error, parsed.fieldErrors);
  const loaded = await loadPolicy(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  if (loaded.row.status !== "draft") return fail("Only a draft can be edited. Take an approved note back to draft first.");
  return movePolicy(g.ctx, id, "draft", { ...parsed.value }, "support_lead.policy.update");
}

export async function approvePolicyNote(id: string): Promise<Done> {
  const g = await approver();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That note could not be found.");
  const loaded = await loadPolicy(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  if (loaded.row.created_by === g.ctx.user.id) return fail("You wrote this note, so someone else has to approve it.");
  if (loaded.row.status !== "draft") return fail("Only a draft can be approved.");
  return movePolicy(g.ctx, id, "draft", { status: "approved", approved_by: g.ctx.user.id, approved_at: new Date().toISOString() }, "support_lead.policy.approve");
}

/** Back to draft, with the reason in the audit line. The inverse of approving. */
export async function withdrawPolicyApproval(id: string, reason: string): Promise<Done> {
  const g = await maker();
  if ("error" in g) {
    const a = await approver();
    if ("error" in a) return fail(g.error);
    return withdraw(a.ctx, id, reason);
  }
  return withdraw(g.ctx, id, reason);
}
async function withdraw(ctx: Ctx, id: string, reason: string): Promise<Done> {
  if (!isUuid(id)) return fail("That note could not be found.");
  const problem = reasonProblem(reason);
  if (problem) return fail(problem, { reason: "Say why." });
  const loaded = await loadPolicy(ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  if (loaded.row.status !== "approved") return fail("Only an approved note can be taken back to draft.");
  const result = await movePolicy(ctx, id, "approved", { status: "draft", approved_by: null, approved_at: null }, "support_lead.policy.withdraw");
  if (result.ok) await auditDesk(ctx.user.id, "support_policy_note", "support_lead.policy.withdraw_reason", id, { reason: trimmed(reason, 200) });
  return result;
}

export async function retirePolicyNote(id: string): Promise<Done> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That note could not be found.");
  const loaded = await loadPolicy(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  if (loaded.row.status === "retired") return fail("That note is already retired.");
  return movePolicy(g.ctx, id, loaded.row.status, { status: "retired", approved_by: null, approved_at: null }, "support_lead.policy.retire");
}

/** The inverse of retiring: back to a draft that needs approval again. */
export async function restorePolicyNote(id: string): Promise<Done> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That note could not be found.");
  const loaded = await loadPolicy(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  if (loaded.row.status !== "retired") return fail("That note is not retired any more, so there is nothing to restore.");
  return movePolicy(g.ctx, id, "retired", { status: "draft" }, "support_lead.policy.restore");
}

type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
const ASSIGN_WORDS: Record<string, string> = {
  taken: "Somebody is working on this ticket right now. It frees up after thirty minutes without a touch.",
  forbidden: "Your access does not cover support tickets.",
  invalid: "That ticket or colleague could not be identified.",
};

/**
 * Hands an open ticket to a member of the support team, through the same
 * database door the queue's assign verb uses (`queue_assign`), which checks
 * the operator's role and writes its own audit row. The Lead's own session
 * is used, never the service client, so the database decides on who they are.
 */
export async function assignTicket(ticketId: string, assigneeId: string): Promise<Done> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  if (!isUuid(ticketId) || !isUuid(assigneeId)) return fail(ASSIGN_WORDS.invalid!);
  const agent = await isSupportAgent(g.ctx.db, assigneeId);
  if (agent === "error") return fail(deskWords({}, NOT_OPEN));
  if (!agent) return fail("Choose a member of the support team from the list.");
  const access = await requireAdmin("support_lead");
  if (access.state !== "admin") return fail(deskRefusal(access.state));
  const { data, error } = await (access.userClient as unknown as Rpc).rpc("queue_assign", { p_kind: "ticket", p_item: ticketId, p_to: assigneeId, p_batch: null });
  if (error) return fail("That did not go through. Nothing was changed. Try again.");
  const status = String((data as { status?: string } | null)?.status ?? "");
  if (status !== "ok") return fail(ASSIGN_WORDS[status] ?? "That did not go through.");
  const note = await auditDesk(g.ctx.user.id, "support_ticket", "support_lead.ticket.assign", ticketId, { to: assigneeId });
  revalidatePath(PATH);
  revalidatePath("/admin/support");
  return ok({ note });
}
