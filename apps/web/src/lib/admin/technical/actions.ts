"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { auditDesk, deskDoor, deskRefusal, deskWords } from "@/lib/admin/desk-door";
import { isUuid, trimmed } from "@/lib/admin/desk-rules";

import { canMoveIncident, isIncidentStatus, looksLikeSecret, parseIncident, parseUpdateBody, SECRET_REFUSAL, type IncidentInput, type IncidentStatus } from "./model";

/**
 * THE TECHNICAL DESK'S WRITES: the incident log only. Declaring an incident,
 * posting an update, resolving with a written summary and reopening. Nothing
 * here touches infrastructure, a key or a deployment. Every export re-checks
 * the door (`requireAdmin("technical")`; the COO is let in to read, never to
 * write), refuses text that looks like a key, token or password, moves a
 * status only along the allowed moves guarded on the status it read, and
 * writes an audit line.
 */

const NOT_OPEN = "The incident tables are not set up on this server yet. Ask the lead to apply the pending migration.";
const PATH = "/admin/technical";
const ENTITY = "tech_incident";

async function door() {
  const d = await deskDoor("technical", { approverMayEnter: true });
  if (d.state !== "ok") return { error: deskRefusal(d.state) } as const;
  if (d.viaApprover) return { error: "The Technical Administrator or an admin keeps the incident log. You can read it." } as const;
  return { ctx: d } as const;
}

type Done = ActionResult<{ note: string | null }>;

export async function declareIncident(input: IncidentInput): Promise<ActionResult<{ id: string; note: string | null }>> {
  const g = await door();
  if ("error" in g) return fail(g.error);
  const parsed = parseIncident(input);
  if ("error" in parsed) return fail(parsed.error, parsed.fieldErrors);
  const { data, error } = await g.ctx.db
    .from("tech_incidents")
    .insert({ ...parsed.value, status: "open", created_by: g.ctx.user.id })
    .select("id")
    .single();
  if (error || !data) return fail(deskWords(error, NOT_OPEN));
  const id = (data as { id: string }).id;
  const note = await auditDesk(g.ctx.user.id, ENTITY, "technical.incident.declare", id, { severity: parsed.value.severity });
  revalidatePath(PATH);
  return ok({ id, note });
}

type Row = { id: string; status: string };

async function load(db: SupabaseClient, id: string): Promise<{ row: Row } | { error: string }> {
  const { data, error } = await db.from("tech_incidents").select("id, status").eq("id", id).maybeSingle();
  if (error) return { error: deskWords(error, NOT_OPEN) };
  if (!data) return { error: "That incident could not be found." };
  return { row: data as unknown as Row };
}

/** An update line, optionally moving the incident to a new status. Resolving goes through `resolveIncidentWith`. */
export async function postIncidentUpdate(id: string, body: string, statusAfter: string): Promise<Done> {
  const g = await door();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That incident could not be found.");
  const text = parseUpdateBody(body);
  if ("error" in text) return fail(text.error, { body: text.error });
  if (statusAfter && (!isIncidentStatus(statusAfter) || statusAfter === "resolved")) return fail("Choose a status from the list. To resolve, use Resolve with a summary.", { statusAfter: "Choose one." });
  const loaded = await load(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  const from = loaded.row.status as IncidentStatus;
  if (from === "resolved") return fail("A resolved incident takes no updates. Reopen it first.");
  if (statusAfter && statusAfter !== from && !canMoveIncident(from, statusAfter as IncidentStatus)) return fail(`A ${from} incident cannot move to ${statusAfter}.`);
  if (statusAfter && statusAfter !== from) {
    const { data, error } = await g.ctx.db.from("tech_incidents").update({ status: statusAfter }).eq("id", id).eq("status", from).select("id");
    if (error) return fail(deskWords(error, NOT_OPEN));
    if (!data || data.length === 0) return fail("That incident has changed since you opened it. Refresh and try again.");
  }
  const { error } = await g.ctx.db.from("tech_incident_updates").insert({ incident_id: id, body: text.value, status_after: statusAfter || null, author_id: g.ctx.user.id });
  if (error) return fail(deskWords(error, NOT_OPEN));
  const note = await auditDesk(g.ctx.user.id, ENTITY, "technical.incident.update", id, { to: statusAfter || null });
  revalidatePath(PATH);
  return ok({ note });
}

/** Resolves an incident with the written summary the log requires. */
export async function resolveIncidentWith(id: string, summary: string): Promise<Done> {
  const g = await door();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That incident could not be found.");
  const text = trimmed(summary, 4000);
  if (text.length < 10) return fail("Write what happened and what was done, at least a sentence.", { summary: "Write a summary." });
  if (looksLikeSecret(text)) return fail(SECRET_REFUSAL, { summary: SECRET_REFUSAL });
  const loaded = await load(g.ctx.db, id);
  if ("error" in loaded) return fail(loaded.error);
  const from = loaded.row.status as IncidentStatus;
  if (!canMoveIncident(from, "resolved")) return fail("That incident is already resolved.");
  const { data, error } = await g.ctx.db
    .from("tech_incidents")
    .update({ status: "resolved", resolved_at: new Date().toISOString(), resolution_summary: text })
    .eq("id", id)
    .eq("status", from)
    .select("id");
  if (error) return fail(deskWords(error, NOT_OPEN));
  if (!data || data.length === 0) return fail("That incident has changed since you opened it. Refresh and try again.");
  await g.ctx.db.from("tech_incident_updates").insert({ incident_id: id, body: "Resolved. See the resolution summary.", status_after: "resolved", author_id: g.ctx.user.id });
  const note = await auditDesk(g.ctx.user.id, ENTITY, "technical.incident.resolve", id, { from });
  revalidatePath(PATH);
  return ok({ note });
}

/** The inverse of resolving: back to investigating, the summary cleared (it is kept in the audit line's update). */
export async function reopenIncident(id: string): Promise<Done> {
  const g = await door();
  if ("error" in g) return fail(g.error);
  if (!isUuid(id)) return fail("That incident could not be found.");
  const { data, error } = await g.ctx.db
    .from("tech_incidents")
    .update({ status: "investigating", resolved_at: null, resolution_summary: null })
    .eq("id", id)
    .eq("status", "resolved")
    .select("id");
  if (error) return fail(deskWords(error, NOT_OPEN));
  if (!data || data.length === 0) return fail("That incident is not resolved any more, so there is nothing to reopen.");
  await g.ctx.db.from("tech_incident_updates").insert({ incident_id: id, body: "Reopened.", status_after: "investigating", author_id: g.ctx.user.id });
  const note = await auditDesk(g.ctx.user.id, ENTITY, "technical.incident.reopen", id);
  revalidatePath(PATH);
  return ok({ note });
}
