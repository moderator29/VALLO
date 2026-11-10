"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { auditDesk, deskDoor, deskRefusal, deskWords, type DeskDoor } from "@/lib/admin/desk-door";
import { isIsoDate, isUuid, koboFromNairaInput, reasonProblem, trimmed } from "@/lib/admin/desk-rules";

import {
  buildUtmLink,
  canMoveStatus,
  isEditable,
  isMetric,
  parseCampaign,
  type CampaignInput,
  type CampaignStatus,
  type Metric,
} from "./model";

/**
 * THE MARKETING DESK'S WRITES. Planning and logging only: nothing here
 * contacts an ad platform or sends a message. Every export re-checks the
 * door itself (`requireAdmin("marketing")`, plus the COO as an approver),
 * validates before any write, moves a status only along the allowed
 * transitions, re-reads the row to check ownership, and writes an audit line.
 * The budget is read and written only by someone who passed the marketing
 * door (or an admin), never by a person let in only to approve.
 */

const NOT_OPEN = "The marketing tables are not set up on this server yet. Ask the lead to apply the pending migration.";
const PATH = "/admin/marketing";
const ENTITY = "marketing_campaign";

type Ctx = Extract<DeskDoor, { state: "ok" }>;
type Gate = { ctx: Ctx } | { error: string };

/** The marketing scope (or an admin); an approver let in only to approve is refused. */
async function maker(): Promise<Gate> {
  const door = await deskDoor("marketing", { approverMayEnter: true });
  if (door.state !== "ok") return { error: deskRefusal(door.state) };
  if (door.viaApprover) return { error: "Only the Marketing Manager or an admin can change a campaign. You can approve or send one back." };
  return { ctx: door };
}

/** An approver: an admin, or the COO or CEO. */
async function approver(): Promise<Gate> {
  const door = await deskDoor("marketing", { approverMayEnter: true });
  if (door.state !== "ok") return { error: deskRefusal(door.state) };
  if (!door.canApprove) return { error: "Only the COO or an admin approves a campaign." };
  return { ctx: door };
}

type Row = { id: string; owner_id: string | null; created_by: string | null; status: string; approval: string };

async function load(db: SupabaseClient, id: string): Promise<{ row: Row } | { error: string }> {
  const { data, error } = await db.from("marketing_campaigns").select("id, owner_id, created_by, status, approval").eq("id", id).maybeSingle();
  if (error) return { error: deskWords(error, NOT_OPEN) };
  if (!data) return { error: "That campaign could not be found." };
  return { row: data as unknown as Row };
}

/** The owner, the person who made it, or an admin. Anyone else holding the scope may read but not change it. */
function mayChange(ctx: Ctx, row: Row): boolean {
  return ctx.isAdminRole || row.owner_id === ctx.user.id || row.created_by === ctx.user.id || (row.owner_id === null && row.created_by === null);
}
const NOT_YOURS = "This campaign belongs to a colleague. Ask them, or an admin, to change it.";

type Done = ActionResult<{ note: string | null }>;

export async function createCampaign(input: CampaignInput): Promise<ActionResult<{ id: string; note: string | null }>> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  const parsed = parseCampaign(input);
  if ("error" in parsed) return fail(parsed.error, parsed.fieldErrors);
  const { data, error } = await g.ctx.db
    .from("marketing_campaigns")
    .insert({ ...parsed.value, status: "draft", approval: "none", owner_id: g.ctx.user.id, created_by: g.ctx.user.id })
    .select("id")
    .single();
  if (error || !data) return fail(deskWords(error, NOT_OPEN));
  const id = (data as { id: string }).id;
  const note = await auditDesk(g.ctx.user.id, ENTITY, "marketing.campaign.create", id, { channel: String(parsed.value.channel) });
  revalidatePath(PATH);
  return ok({ id, note });
}

export async function updateCampaign(id: string, input: CampaignInput): Promise<Done> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That campaign could not be found.");
  const parsed = parseCampaign(input);
  if ("error" in parsed) return fail(parsed.error, parsed.fieldErrors);
  const loaded = await load(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  if (!mayChange(g.ctx, loaded.row)) return fail(NOT_YOURS);
  if (!isEditable(loaded.row.status as CampaignStatus)) return fail("An ended or cancelled campaign can no longer be edited.");
  /* A change after approval needs approval again: the approved version is what was agreed. */
  const reopen = loaded.row.approval === "approved" ? { approval: "none", approved_by: null, approved_at: null, status: loaded.row.status === "planned" ? "draft" : loaded.row.status } : {};
  const { data, error } = await g.ctx.db.from("marketing_campaigns").update({ ...parsed.value, ...reopen }).eq("id", id).in("status", ["draft", "planned", "live", "paused"]).select("id");
  if (error) return fail(deskWords(error, NOT_OPEN));
  if (!data || data.length === 0) return fail("An ended or cancelled campaign can no longer be edited.");
  const note = await auditDesk(g.ctx.user.id, ENTITY, "marketing.campaign.update", id, { reopened: Object.keys(reopen).length > 0 });
  revalidatePath(PATH);
  return ok({ note });
}

/** draft or sent back -> waiting for approval. */
export async function submitCampaign(id: string): Promise<Done> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That campaign could not be found.");
  const loaded = await load(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  if (!mayChange(g.ctx, loaded.row)) return fail(NOT_YOURS);
  const { data, error } = await g.ctx.db
    .from("marketing_campaigns")
    .update({ approval: "submitted", approval_note: null })
    .eq("id", id)
    .eq("status", "draft")
    .in("approval", ["none", "sent_back"])
    .select("id");
  if (error) return fail(deskWords(error, NOT_OPEN));
  if (!data || data.length === 0) return fail("Only a draft that has not been sent for approval can be sent.");
  const note = await auditDesk(g.ctx.user.id, ENTITY, "marketing.campaign.submit", id);
  revalidatePath(PATH);
  return ok({ note });
}

/** waiting -> approved, and the draft becomes planned. Never the person who made it. */
export async function approveCampaign(id: string): Promise<Done> {
  const g = await approver();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That campaign could not be found.");
  const loaded = await load(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  if (loaded.row.created_by === g.ctx.user.id) return fail("You made this campaign, so someone else has to approve it.");
  const { data, error } = await g.ctx.db
    .from("marketing_campaigns")
    .update({ approval: "approved", approval_note: null, approved_by: g.ctx.user.id, approved_at: new Date().toISOString(), status: "planned" })
    .eq("id", id)
    .eq("status", "draft")
    .eq("approval", "submitted")
    .select("id");
  if (error) return fail(deskWords(error, NOT_OPEN));
  if (!data || data.length === 0) return fail("Only a campaign waiting for approval can be approved.");
  const note = await auditDesk(g.ctx.user.id, ENTITY, "marketing.campaign.approve", id);
  revalidatePath(PATH);
  return ok({ note });
}

/** waiting -> sent back, with the reason the manager will read. */
export async function sendBackCampaign(id: string, reason: string): Promise<Done> {
  const g = await approver();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That campaign could not be found.");
  const problem = reasonProblem(reason);
  if (problem) return fail(problem, { reason: "Say why." });
  const loaded = await load(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  if (loaded.row.created_by === g.ctx.user.id) return fail("You made this campaign, so someone else has to decide it.");
  const { data, error } = await g.ctx.db
    .from("marketing_campaigns")
    .update({ approval: "sent_back", approval_note: trimmed(reason, 1000) })
    .eq("id", id)
    .eq("approval", "submitted")
    .select("id");
  if (error) return fail(deskWords(error, NOT_OPEN));
  if (!data || data.length === 0) return fail("Only a campaign waiting for approval can be sent back.");
  const note = await auditDesk(g.ctx.user.id, ENTITY, "marketing.campaign.send_back", id, { reason: trimmed(reason, 200) });
  revalidatePath(PATH);
  return ok({ note });
}

/** Moves a campaign along planned -> live -> paused -> ended. Live needs an approved campaign. */
export async function setCampaignStatus(id: string, next: string): Promise<Done> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That campaign could not be found.");
  if (!["live", "paused", "ended", "cancelled"].includes(next)) return fail("That is not a status you can move a campaign to.");
  const loaded = await load(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  if (!mayChange(g.ctx, loaded.row)) return fail(NOT_YOURS);
  const from = loaded.row.status as CampaignStatus;
  if (!canMoveStatus(from, next as CampaignStatus)) return fail(`A ${from} campaign cannot move to ${next}.`);
  if (next === "live" && loaded.row.approval !== "approved") return fail("A campaign goes live only after it is approved.");
  const { data, error } = await g.ctx.db.from("marketing_campaigns").update({ status: next }).eq("id", id).eq("status", from).select("id");
  if (error) return fail(deskWords(error, NOT_OPEN));
  if (!data || data.length === 0) return fail("That campaign has changed since you opened it. Refresh and try again.");
  const note = await auditDesk(g.ctx.user.id, ENTITY, `marketing.campaign.${next}`, id, { from });
  revalidatePath(PATH);
  return ok({ note });
}

/** The inverse of cancelling: back to a draft that needs approval again. */
export async function restoreCancelledCampaign(id: string): Promise<Done> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That campaign could not be found.");
  const loaded = await load(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  if (!mayChange(g.ctx, loaded.row)) return fail(NOT_YOURS);
  const { data, error } = await g.ctx.db
    .from("marketing_campaigns")
    .update({ status: "draft", approval: "none", approved_by: null, approved_at: null })
    .eq("id", id)
    .eq("status", "cancelled")
    .select("id");
  if (error) return fail(deskWords(error, NOT_OPEN));
  if (!data || data.length === 0) return fail("That campaign is not cancelled any more, so there is nothing to restore.");
  const note = await auditDesk(g.ctx.user.id, ENTITY, "marketing.campaign.restore", id);
  revalidatePath(PATH);
  return ok({ note });
}

export type ResultInput = { campaignId: string; recordedOn: string; metric: string; value: string; note: string };

/** Logs a number against a campaign. Spend is typed in naira and stored in kobo. */
export async function logResult(input: ResultInput): Promise<ActionResult<{ id: string; note: string | null }>> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  if (!isUuid(input.campaignId)) return fail("Choose a campaign.", { campaignId: "Choose one." });
  if (!isMetric(input.metric)) return fail("Choose what you are logging.", { metric: "Choose one." });
  if (!isIsoDate(input.recordedOn)) return fail("Choose the date the number is for.", { recordedOn: "Choose a date." });
  const metric = input.metric as Metric;
  let value: number;
  if (metric === "spend_kobo") {
    const kobo = koboFromNairaInput(input.value);
    if (kobo === null) return fail("Enter the spend in naira, such as 15000.", { value: "Enter naira." });
    value = kobo;
  } else {
    const text = trimmed(input.value, 20).replace(/,/g, "");
    if (!/^\d+(\.\d+)?$/.test(text)) return fail("Enter a number, zero or more.", { value: "Enter a number." });
    value = Number(text);
  }
  const loaded = await load(g.ctx.db, input.campaignId);
  if ("error" in loaded) return fail(loaded.error);
  if (!mayChange(g.ctx, loaded.row)) return fail(NOT_YOURS);
  if (loaded.row.status === "cancelled") return fail("A cancelled campaign takes no new numbers.");
  const { data, error } = await g.ctx.db
    .from("marketing_campaign_results")
    .insert({ campaign_id: input.campaignId, recorded_on: input.recordedOn, metric, value, note: trimmed(input.note, 500), recorded_by: g.ctx.user.id })
    .select("id")
    .single();
  if (error || !data) return fail(deskWords(error, NOT_OPEN));
  const id = (data as { id: string }).id;
  const note = await auditDesk(g.ctx.user.id, "marketing_result", "marketing.result.log", id, { campaign: input.campaignId, metric });
  revalidatePath(PATH);
  return ok({ id, note });
}

/** Voids a logged number (kept on record, left out of every total). */
export async function voidResult(id: string): Promise<Done> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That entry could not be found.");
  const { data, error } = await g.ctx.db
    .from("marketing_campaign_results")
    .update({ voided_at: new Date().toISOString(), voided_by: g.ctx.user.id })
    .eq("id", id)
    .is("voided_at", null)
    .select("id");
  if (error) return fail(deskWords(error, NOT_OPEN));
  if (!data || data.length === 0) return fail("That entry is already removed.");
  const note = await auditDesk(g.ctx.user.id, "marketing_result", "marketing.result.void", id);
  revalidatePath(PATH);
  return ok({ note });
}

/** The inverse of voiding, behind the banner's Undo. */
export async function unvoidResult(id: string): Promise<Done> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That entry could not be found.");
  const { data, error } = await g.ctx.db
    .from("marketing_campaign_results")
    .update({ voided_at: null, voided_by: null })
    .eq("id", id)
    .not("voided_at", "is", null)
    .select("id");
  if (error) return fail(deskWords(error, NOT_OPEN));
  if (!data || data.length === 0) return fail("That entry is not removed any more.");
  const note = await auditDesk(g.ctx.user.id, "marketing_result", "marketing.result.unvoid", id);
  revalidatePath(PATH);
  return ok({ note });
}

export type UtmSave = { base: string; source: string; medium: string; campaign: string; content: string; term: string };

/** Saves the tracked-link tags on a campaign. The link is validated by the same pure builder the screen uses. */
export async function saveCampaignUtm(id: string, input: UtmSave): Promise<Done> {
  const g = await maker();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That campaign could not be found.");
  const built = buildUtmLink(input);
  if (!built.ok) return fail(built.error, { [built.field]: built.error });
  const loaded = await load(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  if (!mayChange(g.ctx, loaded.row)) return fail(NOT_YOURS);
  if (!isEditable(loaded.row.status as CampaignStatus)) return fail("An ended or cancelled campaign can no longer be edited.");
  const { data, error } = await g.ctx.db
    .from("marketing_campaigns")
    .update({
      utm_base: trimmed(input.base, 300),
      utm_source: built.tags.utm_source ?? null,
      utm_medium: built.tags.utm_medium ?? null,
      utm_campaign: built.tags.utm_campaign ?? null,
      utm_content: built.tags.utm_content ?? null,
      utm_term: built.tags.utm_term ?? null,
    })
    .eq("id", id)
    .select("id");
  if (error) return fail(deskWords(error, NOT_OPEN));
  if (!data || data.length === 0) return fail("That campaign could not be found.");
  const note = await auditDesk(g.ctx.user.id, ENTITY, "marketing.campaign.utm", id);
  revalidatePath(PATH);
  return ok({ note });
}
