"use server";

import { memberWriteLimit } from "../security/member-write-limit";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDictionary } from "@vallo/i18n";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { resolveSession, SIGNED_OUT_MESSAGE } from "../actions/session";
import { getLocale } from "../locale";
import { BRIEF_PROPERTY_TYPES } from "./brief";

/**
 * V-95: POST, CLOSE AND ANSWER A BRIEF, each one guarded database function
 * under the caller's own client. The functions decide who may do what (a
 * verified lister covering an area answers; only with their own published,
 * real listing; three per brief); these translate a refusal into a sentence.
 *
 * This module exports only async functions, per the server-actions rule.
 */

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { hint?: string; code?: string } | null }>;

const postSchema = z.object({
  stateCode: z.string().regex(/^[A-Z]{2}$/),
  areas: z.array(z.string().min(2).max(60)).min(1).max(3),
  intent: z.enum(["rent", "sale"]),
  propertyType: z.enum(BRIEF_PROPERTY_TYPES).nullable(),
  bedroomsMin: z.number().int().min(0).max(10).nullable(),
  maxMinor: z.number().int().positive().nullable(),
  moveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  savedSearchId: z.string().uuid().nullable().optional(),
});

export async function postBrief(input: unknown): Promise<ActionResult<{ id: string }>> {
  const t = getDictionary(await getLocale()).frontDoor.briefs;
  const parsed = validate(postSchema, input);
  if (!parsed.ok) return fail(parsed.error.includes("area") ? t.problems.brief_areas : t.problems.failed);
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(SIGNED_OUT_MESSAGE);
  const rpc = session.supabase.rpc.bind(session.supabase) as unknown as Rpc;
  const v = parsed.data;
  /* B-03: a ceiling on briefs, so listers are not buried in one person's. */
  const tooMany = await memberWriteLimit("brief_post", session.user.id);
  if (tooMany) return fail(tooMany.error);
  const { data, error } = await rpc("post_brief", {
    p_state_code: v.stateCode,
    p_areas: v.areas,
    p_intent: v.intent,
    p_property_type: v.propertyType,
    p_bedrooms_min: v.bedroomsMin,
    p_max_minor: v.maxMinor,
    p_move_from: v.moveFrom,
    p_saved_search: v.savedSearchId ?? null,
  });
  if (error || typeof data !== "string") {
    const hint = error?.hint as keyof typeof t.problems | undefined;
    return fail(hint && hint in t.problems ? t.problems[hint] : t.problems.failed);
  }
  revalidatePath("/saved/searches");
  return ok({ id: data });
}

export async function closeBrief(input: unknown): Promise<ActionResult<null>> {
  const t = getDictionary(await getLocale()).frontDoor.briefs;
  const parsed = validate(z.object({ id: z.string().uuid() }), input);
  if (!parsed.ok) return fail(t.problems.failed);
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(SIGNED_OUT_MESSAGE);
  const rpc = session.supabase.rpc.bind(session.supabase) as unknown as Rpc;
  const { error } = await rpc("close_brief", { p_brief: parsed.data.id });
  if (error) return fail(t.problems.failed);
  revalidatePath("/saved/searches");
  return ok(null);
}

export async function answerBrief(input: unknown): Promise<ActionResult<null>> {
  const t = getDictionary(await getLocale()).frontDoor.briefs;
  const parsed = validate(z.object({ briefId: z.string().uuid(), listingId: z.string().uuid() }), input);
  if (!parsed.ok) return fail(t.answerProblems.failed);
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(SIGNED_OUT_MESSAGE);
  const rpc = session.supabase.rpc.bind(session.supabase) as unknown as Rpc;
  const { error } = await rpc("answer_brief", { p_brief: parsed.data.briefId, p_listing: parsed.data.listingId });
  if (error) {
    if (error.code === "42501") return fail(t.notVerified);
    const hint = error.hint as keyof typeof t.answerProblems | undefined;
    return fail(hint && hint in t.answerProblems ? t.answerProblems[hint] : t.answerProblems.failed);
  }
  revalidatePath("/agent/messages");
  return ok(null);
}
