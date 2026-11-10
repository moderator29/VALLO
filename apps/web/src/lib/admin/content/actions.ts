"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { auditDesk, deskDoor, deskRefusal, deskWords, type DeskDoor } from "@/lib/admin/desk-door";
import { isHttpUrl, isIsoDate, isUuid, reasonProblem, trimmed } from "@/lib/admin/desk-rules";

import { canMove, isEditable, needsPublishedUrl, parseItem, type ItemInput, type Kind, type Status } from "./model";

/**
 * THE CONTENT DESK'S WRITES. Text and links only: nothing here publishes to a
 * website or a platform. "Published" records that a person put it live and
 * where. Every export re-checks the door (`requireAdmin("content")`, plus the
 * COO as an approver), validates before any write, moves a status only along
 * the allowed transitions guarded on the status it read, checks ownership, and
 * writes an audit line.
 */

const NOT_OPEN = "The content table is not set up on this server yet. Ask the lead to apply the pending migration.";
const PATH = "/admin/content";
const ENTITY = "content_item";

type Ctx = Extract<DeskDoor, { state: "ok" }>;
type Gate = { ctx: Ctx } | { error: string };

async function maker(): Promise<Gate> {
  const door = await deskDoor("content", { approverMayEnter: true });
  if (door.state !== "ok") return { error: deskRefusal(door.state) };
  if (door.viaApprover) return { error: "Only the Content Manager or an admin can change an item. You can approve or send one back." };
  return { ctx: door };
}

async function approver(): Promise<Gate> {
  const door = await deskDoor("content", { approverMayEnter: true });
  if (door.state !== "ok") return { error: deskRefusal(door.state) };
  if (!door.canApprove) return { error: "Only the COO or an admin approves content." };
  return { ctx: door };
}

type Row = { id: string; kind: string; owner_id: string | null; created_by: string | null; status: string };

async function load(db: SupabaseClient, id: string): Promise<{ row: Row } | { error: string }> {
  const { data, error } = await db.from("content_items").select("id, kind, owner_id, created_by, status").eq("id", id).maybeSingle();
  if (error) return { error: deskWords(error, NOT_OPEN) };
  if (!data) return { error: "That item could not be found." };
  return { row: data as unknown as Row };
}

function mayChange(ctx: Ctx, row: Row): boolean {
  return ctx.isAdminRole || row.owner_id === ctx.user.id || row.created_by === ctx.user.id || (row.owner_id === null && row.created_by === null);
}
const NOT_YOURS = "This item belongs to a colleague. Ask them, or an admin, to change it.";

type Done = ActionResult<{ note: string | null }>;

async function move(
  ctx: Ctx,
  id: string,
  from: Status,
  patch: Record<string, string | null>,
  action: string,
  detail: Record<string, string | number | boolean | null> = {},
): Promise<Done> {
  const { data, error } = await ctx.db.from("content_items").update(patch).eq("id", id).eq("status", from).select("id");
  if (error) return fail(deskWords(error, NOT_OPEN));
  if (!data || data.length === 0) return fail("That item has changed since you opened it. Refresh and try again.");
  const note = await auditDesk(ctx.user.id, ENTITY, action, id, { from, ...detail });
  revalidatePath(PATH);
  return ok({ note });
}

export async function createItem(input: ItemInput): Promise<ActionResult<{ id: string; note: string | null }>> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  const parsed = parseItem(input);
  if ("error" in parsed) return fail(parsed.error, parsed.fieldErrors);
  const { data, error } = await g.ctx.db
    .from("content_items")
    .insert({ ...parsed.value, status: "draft", owner_id: g.ctx.user.id, created_by: g.ctx.user.id })
    .select("id")
    .single();
  if (error || !data) return fail(deskWords(error, NOT_OPEN));
  const id = (data as { id: string }).id;
  const note = await auditDesk(g.ctx.user.id, ENTITY, "content.item.create", id, { kind: String(parsed.value.kind) });
  revalidatePath(PATH);
  return ok({ id, note });
}

/** Edits a draft in place. Anything further along goes back to draft first. */
export async function updateItem(id: string, input: ItemInput): Promise<Done> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That item could not be found.");
  const parsed = parseItem(input);
  if ("error" in parsed) return fail(parsed.error, parsed.fieldErrors);
  const loaded = await load(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  if (!mayChange(g.ctx, loaded.row)) return fail(NOT_YOURS);
  if (!isEditable(loaded.row.status as Status)) return fail("Only a draft can be edited. Send it back to draft first.");
  return move(g.ctx, id, "draft", { ...parsed.value }, "content.item.update");
}

export async function submitItem(id: string): Promise<Done> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That item could not be found.");
  const loaded = await load(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  if (!mayChange(g.ctx, loaded.row)) return fail(NOT_YOURS);
  if (!canMove(loaded.row.status as Status, "in_review")) return fail("Only a draft can be sent for approval.");
  return move(g.ctx, id, "draft", { status: "in_review", review_note: null }, "content.item.submit");
}

/** in_review -> approved. Never the person who made it. */
export async function approveItem(id: string): Promise<Done> {
  const g = await approver();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That item could not be found.");
  const loaded = await load(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  if (loaded.row.created_by === g.ctx.user.id) return fail("You made this item, so someone else has to approve it.");
  if (!canMove(loaded.row.status as Status, "approved")) return fail("Only an item in review can be approved.");
  return move(g.ctx, id, "in_review", { status: "approved", approver_id: g.ctx.user.id, approved_at: new Date().toISOString(), review_note: null }, "content.item.approve");
}

/** in_review or approved -> draft, with the reason the writer will read. */
export async function sendBackItem(id: string, reason: string): Promise<Done> {
  const g = await approver();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That item could not be found.");
  const problem = reasonProblem(reason);
  if (problem) return fail(problem, { reason: "Say why." });
  const loaded = await load(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  if (loaded.row.created_by === g.ctx.user.id) return fail("You made this item, so someone else has to decide it.");
  const from = loaded.row.status as Status;
  if ((from !== "in_review" && from !== "approved") || !canMove(from, "draft")) return fail("Only an item in review or approved can be sent back.");
  return move(g.ctx, id, from, { status: "draft", review_note: trimmed(reason, 1000), approver_id: null, approved_at: null }, "content.item.send_back", { reason: trimmed(reason, 200) });
}

export type PublishInput = { url: string; publishedAt: string };

/** approved -> published, recording where it went live. */
export async function markPublished(id: string, input: PublishInput): Promise<Done> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That item could not be found.");
  const url = trimmed(input.url, 2000);
  if (url && !isHttpUrl(url)) return fail("That does not look like a link.", { url: "Paste the live link." });
  if (input.publishedAt && !isIsoDate(input.publishedAt)) return fail("Choose a real date.", { publishedAt: "Choose a date." });
  const loaded = await load(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  if (!mayChange(g.ctx, loaded.row)) return fail(NOT_YOURS);
  if (!canMove(loaded.row.status as Status, "published")) return fail("Only an approved item can be marked published.");
  if (!url && needsPublishedUrl(loaded.row.kind as Kind)) return fail("Add the link where it is now live.", { url: "Paste the live link." });
  const at = input.publishedAt ? new Date(`${input.publishedAt}T12:00:00+01:00`).toISOString() : new Date().toISOString();
  return move(g.ctx, id, "approved", { status: "published", published_url: url || null, published_at: at }, "content.item.publish", { url: url || null });
}

/** draft or published -> retired. The banner offers the inverse. */
export async function retireItem(id: string): Promise<Done> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That item could not be found.");
  const loaded = await load(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  if (!mayChange(g.ctx, loaded.row)) return fail(NOT_YOURS);
  const from = loaded.row.status as Status;
  if (!canMove(from, "retired")) return fail("Only a draft or a published item can be retired.");
  return move(g.ctx, id, from, { status: "retired" }, "content.item.retire");
}

/** The inverse of retiring: back to a draft that goes through approval again. */
export async function restoreRetiredItem(id: string): Promise<Done> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That item could not be found.");
  const loaded = await load(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  if (!mayChange(g.ctx, loaded.row)) return fail(NOT_YOURS);
  if (!canMove(loaded.row.status as Status, "draft") || loaded.row.status !== "retired") return fail("That item is not retired any more, so there is nothing to restore.");
  return move(g.ctx, id, "retired", { status: "draft", approver_id: null, approved_at: null, published_url: null, published_at: null }, "content.item.restore");
}
