"use server";

/**
 * An agent's two small tools: reply templates and reachable hours. Every write
 * runs under the member's own RLS-bound client. Async functions only; the pure
 * halves are `./reply-templates` and `./hours`.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { cleanTemplate, TEMPLATE_LIMIT, type ReplyTemplate } from "./reply-templates";
import { isTime, readSchedule, WEEKDAYS } from "./hours";

const DOWN = "We could not save that just now. Please try again in a moment.";

type Result = { error: { code?: string } | null };
type Loose = {
  from(table: string): {
    insert(row: Record<string, unknown>): { select(cols: string): { single(): PromiseLike<{ data: unknown } & Result> } };
    upsert(row: Record<string, unknown>): PromiseLike<Result>;
    delete(): { eq(col: string, v: string): { eq(col: string, v: string): PromiseLike<Result> } };
  };
};

async function member() {
  const session = await resolveSession();
  if (session.state === "unconfigured") return { ok: false, error: NOT_CONFIGURED_MESSAGE } as const;
  if (session.state === "signed-out") return { ok: false, error: SIGNED_OUT_MESSAGE } as const;
  return { ok: true, db: session.supabase as unknown as Loose, userId: session.user.id } as const;
}

export async function createReplyTemplate(input: { title: string; body: string }): Promise<ActionResult<ReplyTemplate>> {
  const parsed = validate(z.object({ title: z.string().max(300), body: z.string().max(5000) }), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const clean = cleanTemplate(parsed.data);
  if (!clean) return fail("Give the reply a short title and some words.");
  const who = await member();
  if (!who.ok) return fail(who.error);
  const { data, error } = await who.db
    .from("reply_templates")
    .insert({ user_id: who.userId, ...clean })
    .select("id, title, body")
    .single();
  if (error || !data) {
    if (error?.code === "P0001") return fail(`You can keep up to ${TEMPLATE_LIMIT} replies. Delete one to add another.`);
    return fail(DOWN);
  }
  revalidatePath("/agent/settings");
  return ok(data as ReplyTemplate);
}

export async function deleteReplyTemplate(input: { id: string }): Promise<ActionResult<null>> {
  const parsed = validate(z.object({ id: z.uuid() }), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const who = await member();
  if (!who.ok) return fail(who.error);
  const { error } = await who.db.from("reply_templates").delete().eq("id", parsed.data.id).eq("user_id", who.userId);
  if (error) return fail(DOWN);
  revalidatePath("/agent/settings");
  return ok(null);
}

const daySchema = z.union([z.null(), z.object({ open: z.string().refine(isTime), close: z.string().refine(isTime) })]);

export async function saveAgentHours(input: Record<string, unknown>): Promise<ActionResult<null>> {
  const parsed = validate(z.object(Object.fromEntries(WEEKDAYS.map((d) => [d, daySchema.optional()]))), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const schedule = readSchedule(parsed.data);
  const who = await member();
  if (!who.ok) return fail(who.error);
  const { error } = await who.db
    .from("agent_hours")
    .upsert({ user_id: who.userId, schedule, updated_at: new Date().toISOString() });
  if (error) return fail(DOWN);
  revalidatePath("/agent/settings");
  return ok(null);
}
