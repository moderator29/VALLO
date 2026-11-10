"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { auditDesk, deskDoor, deskRefusal, deskWords, type DeskDoor } from "@/lib/admin/desk-door";
import { isUuid, reasonProblem, trimmed } from "@/lib/admin/desk-rules";

import { isEntryEditable, kindDef, parseEntry, startStatus, type EntryDesk, type EntryInput, type EntryStatus, type KindDef } from "./model";

/**
 * THE SMALLER TOOLS' WRITES, for all four desks. Each export finds the desk
 * the kind belongs to, passes that desk's own door (`requireAdmin(scope)`,
 * with the COO let in only to approve), validates against the kind before any
 * write, moves a status only along the kind's flow guarded on the status it
 * read, checks ownership, and writes an audit line. A kind belonging to one
 * desk can never be written through another desk's scope.
 */

const NOT_OPEN = "The desk tables are not set up on this server yet. Ask the lead to apply the pending migration.";
const ENTITY = "staff_desk_entry";
const SCOPE: Record<EntryDesk, "marketing" | "content" | "technical" | "support_lead"> = {
  marketing: "marketing",
  content: "content",
  technical: "technical",
  support_lead: "support_lead",
};
const PATH: Record<EntryDesk, string> = { marketing: "/admin/marketing", content: "/admin/content", technical: "/admin/technical", support_lead: "/admin/support-lead" };

type Ctx = Extract<DeskDoor, { state: "ok" }>;
type Gate = { ctx: Ctx; def: KindDef } | { error: string };
type Row = { id: string; desk: string; kind: string; status: string; owner_id: string | null; created_by: string | null };
type Done = ActionResult<{ note: string | null }>;

async function gate(kind: string, who: "maker" | "approver"): Promise<Gate> {
  const def = kindDef(kind);
  if (!def) return { error: "That is not a tool this desk has." };
  const door = await deskDoor(SCOPE[def.desk], { approverMayEnter: true });
  if (door.state !== "ok") return { error: deskRefusal(door.state) };
  if (who === "maker" && door.viaApprover) return { error: "You are here to approve. The desk's own manager makes the changes." };
  if (who === "approver" && !door.canApprove) return { error: "Only the COO or an admin approves this." };
  return { ctx: door, def };
}

async function load(db: SupabaseClient, id: string): Promise<{ row: Row; def: KindDef } | { error: string }> {
  const { data, error } = await db.from("staff_desk_entries").select("id, desk, kind, status, owner_id, created_by").eq("id", id).maybeSingle();
  if (error) return { error: deskWords(error, NOT_OPEN) };
  if (!data) return { error: "That entry could not be found." };
  const row = data as unknown as Row;
  const def = kindDef(row.kind);
  if (!def || def.desk !== row.desk) return { error: "That entry could not be found." };
  return { row, def };
}

/** The owner, the person who made it, or an admin. */
function mayChange(ctx: Ctx, row: Row): boolean {
  return ctx.isAdminRole || row.owner_id === ctx.user.id || row.created_by === ctx.user.id || (row.owner_id === null && row.created_by === null);
}
const NOT_YOURS = "This belongs to a colleague. Ask them, or an admin, to change it.";

/** Loads an entry and passes the right gate for the desk its kind belongs to. */
async function open(id: string, who: "maker" | "approver", db?: SupabaseClient): Promise<{ ctx: Ctx; row: Row; def: KindDef } | { error: string }> {
  if (!isUuid(id)) return { error: "That entry could not be found." };
  /* The kind lives on the row, so read it with whichever door the caller passes first. */
  for (const desk of ["marketing", "content", "technical", "support_lead"] as const) {
    const door = await deskDoor(SCOPE[desk], { approverMayEnter: true });
    if (door.state !== "ok") continue;
    const loaded = await load(db ?? door.db, id);
    if ("error" in loaded) return loaded;
    if (loaded.def.desk !== desk) continue;
    const g = await gate(loaded.row.kind, who);
    if ("error" in g) return g;
    return { ctx: g.ctx, row: loaded.row, def: loaded.def };
  }
  return { error: deskRefusal("not-admin") };
}

async function move(ctx: Ctx, row: Row, from: EntryStatus, patch: Record<string, unknown>, action: string, detail: Record<string, string | number | boolean | null> = {}): Promise<Done> {
  const { data, error } = await ctx.db.from("staff_desk_entries").update(patch).eq("id", row.id).eq("status", from).select("id");
  if (error) return fail(deskWords(error, NOT_OPEN));
  if (!data || data.length === 0) return fail("That has changed since you opened it. Refresh and try again.");
  const note = await auditDesk(ctx.user.id, ENTITY, action, row.id, { kind: row.kind, from, ...detail });
  revalidatePath(PATH[row.desk as EntryDesk]);
  return ok({ note });
}

async function subjectProblem(ctx: Ctx, def: KindDef, subject: string | null): Promise<string | null> {
  if (!def.subject || !subject) return null;
  const { data, error } = await ctx.db.from("staff_grants").select("user_id").eq("user_id", subject).is("revoked_at", null).contains("scopes", ["support"]).maybeSingle();
  if (error) return deskWords(error, NOT_OPEN);
  return data ? null : "Choose a member of the support team from the list.";
}

export async function createEntry(kind: string, input: EntryInput): Promise<ActionResult<{ id: string; note: string | null }>> {
  const g = await gate(kind, "maker");
  if ("error" in g) return fail(g.error);
  const parsed = parseEntry(g.def, input);
  if ("error" in parsed) return fail(parsed.error, parsed.fieldErrors);
  const problem = await subjectProblem(g.ctx, g.def, parsed.value.subject_user);
  if (problem) return fail(problem, { subjectUser: problem });
  const { data, error } = await g.ctx.db
    .from("staff_desk_entries")
    .insert({ ...parsed.value, desk: g.def.desk, kind: g.def.kind, status: startStatus(g.def), owner_id: g.ctx.user.id, created_by: g.ctx.user.id })
    .select("id")
    .single();
  if (error || !data) return fail(deskWords(error, NOT_OPEN));
  const id = (data as { id: string }).id;
  const note = await auditDesk(g.ctx.user.id, ENTITY, `${g.def.desk}.entry.create`, id, { kind });
  revalidatePath(PATH[g.def.desk]);
  return ok({ id, note });
}

export async function updateEntry(id: string, input: EntryInput): Promise<Done> {
  const o = await open(id, "maker");
  if ("error" in o) return fail(o.error);
  const parsed = parseEntry(o.def, input);
  if ("error" in parsed) return fail(parsed.error, parsed.fieldErrors);
  if (!mayChange(o.ctx, o.row)) return fail(NOT_YOURS);
  const status = o.row.status as EntryStatus;
  if (!isEntryEditable(o.def, status)) return fail("This can no longer be edited. Retired or waiting for a decision.");
  const problem = await subjectProblem(o.ctx, o.def, parsed.value.subject_user);
  if (problem) return fail(problem, { subjectUser: problem });
  return move(o.ctx, o.row, status, { ...parsed.value }, `${o.def.desk}.entry.update`);
}

/** open <-> done, for plain tools. The banner's Undo calls it the other way round. */
export async function setEntryDone(id: string, done: boolean): Promise<Done> {
  const o = await open(id, "maker");
  if ("error" in o) return fail(o.error);
  if (o.def.flow !== "plain") return fail("This tool moves through approval, not done and open.");
  if (!mayChange(o.ctx, o.row)) return fail(NOT_YOURS);
  const from: EntryStatus = done ? "open" : "done";
  if (o.row.status !== from) return fail(done ? "Only an open entry can be marked done." : "That is not marked done any more.");
  return move(o.ctx, o.row, from, { status: done ? "done" : "open" }, `${o.def.desk}.entry.${done ? "done" : "reopen"}`);
}

export async function retireEntry(id: string): Promise<Done> {
  const o = await open(id, "maker");
  if ("error" in o) return fail(o.error);
  if (!mayChange(o.ctx, o.row)) return fail(NOT_YOURS);
  const from = o.row.status as EntryStatus;
  if (from === "retired" || from === "submitted") return fail(from === "submitted" ? "Wait for the decision, or ask for it to be sent back, first." : "That is already retired.");
  /* Where it was is remembered in the audit line; restoring starts it again from the flow's start. */
  return move(o.ctx, o.row, from, { status: "retired" }, `${o.def.desk}.entry.retire`);
}

export async function restoreEntry(id: string): Promise<Done> {
  const o = await open(id, "maker");
  if ("error" in o) return fail(o.error);
  if (!mayChange(o.ctx, o.row)) return fail(NOT_YOURS);
  if (o.row.status !== "retired") return fail("That is not retired any more, so there is nothing to restore.");
  return move(o.ctx, o.row, "retired", { status: startStatus(o.def), approved_by: null, approved_at: null }, `${o.def.desk}.entry.restore`);
}

export async function submitEntry(id: string): Promise<Done> {
  const o = await open(id, "maker");
  if ("error" in o) return fail(o.error);
  if (o.def.flow !== "approval") return fail("This tool does not need approval.");
  if (!mayChange(o.ctx, o.row)) return fail(NOT_YOURS);
  const from = o.row.status as EntryStatus;
  if (from !== "draft" && from !== "sent_back") return fail("Only a draft can be sent for approval.");
  return move(o.ctx, o.row, from, { status: "submitted", review_note: null }, `${o.def.desk}.entry.submit`);
}

/** submitted -> approved. Never the person who made it. */
export async function approveEntry(id: string): Promise<Done> {
  const o = await open(id, "approver");
  if ("error" in o) return fail(o.error);
  if (o.def.flow !== "approval") return fail("This tool does not need approval.");
  if (o.row.created_by === o.ctx.user.id) return fail("You made this, so someone else has to approve it.");
  if (o.row.status !== "submitted") return fail("Only something waiting for approval can be approved.");
  return move(o.ctx, o.row, "submitted", { status: "approved", approved_by: o.ctx.user.id, approved_at: new Date().toISOString(), review_note: null }, `${o.def.desk}.entry.approve`);
}

export async function sendBackEntry(id: string, reason: string): Promise<Done> {
  const o = await open(id, "approver");
  if ("error" in o) return fail(o.error);
  const problem = reasonProblem(reason);
  if (problem) return fail(problem, { reason: "Say why." });
  if (o.def.flow !== "approval") return fail("This tool does not need approval.");
  if (o.row.created_by === o.ctx.user.id) return fail("You made this, so someone else has to decide it.");
  if (o.row.status !== "submitted") return fail("Only something waiting for approval can be sent back.");
  return move(o.ctx, o.row, "submitted", { status: "sent_back", review_note: trimmed(reason, 1000) }, `${o.def.desk}.entry.send_back`, { reason: trimmed(reason, 200) });
}

/** An approved entry goes back to draft to be changed; it needs approval again. */
export async function reopenEntry(id: string): Promise<Done> {
  const o = await open(id, "maker");
  if ("error" in o) return fail(o.error);
  if (o.def.flow !== "approval") return fail("This tool does not need approval.");
  if (!mayChange(o.ctx, o.row)) return fail(NOT_YOURS);
  if (o.row.status !== "approved") return fail("Only an approved entry can be taken back to draft.");
  return move(o.ctx, o.row, "approved", { status: "draft", approved_by: null, approved_at: null }, `${o.def.desk}.entry.reopen`);
}
