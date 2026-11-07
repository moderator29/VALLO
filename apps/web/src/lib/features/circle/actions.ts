"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, validate, type ActionResult } from "@/lib/actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "@/lib/actions/session";

import { isNotLive } from "../degrade";
import { CIRCLE_CATEGORIES, LIMITS, readCreateOutcome, slugFrom } from "./model";

/**
 * VALLO CIRCLE, THE WRITES. Every one goes through the member's own client:
 * the RLS policies and the database functions hold the rules (a member to
 * post, an owner to decide, the asker to accept), and this file only shapes
 * the input and the words that come back. A rule the database refuses with
 * one of its own sentences (an RM code) is shown as that sentence.
 */

const NOT_OPEN = "Circle is not open on this server yet.";
const FAILED = "That did not go through. Try again.";

type Db = SupabaseClient;

async function member(): Promise<{ db: Db; userId: string } | { error: string }> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return { error: NOT_CONFIGURED_MESSAGE };
  if (session.state === "signed-out") return { error: SIGNED_OUT_MESSAGE };
  return { db: session.supabase as unknown as Db, userId: session.user.id };
}

/** The database's own sentence for a rule it holds, or the plain failure. */
function wordsFor(error: { code?: string; message?: string } | null): string {
  if (!error) return FAILED;
  if (isNotLive(error)) return NOT_OPEN;
  if (typeof error.code === "string" && /^RM\d{3}$/.test(error.code) && error.message) return error.message;
  return FAILED;
}

const uuid = z.string().uuid("That could not be found.");

/* ------------------------------------------------------------ communities */

const createSchema = z.object({
  name: z.string().trim().min(LIMITS.nameMin, "Give it a name of 3 letters or more.").max(LIMITS.nameMax, "Keep the name to 60 characters."),
  description: z.string().trim().max(LIMITS.descriptionMax, "Keep the description to 500 characters."),
  category: z.enum(CIRCLE_CATEGORIES, { message: "Choose what it is about." }),
  visibility: z.enum(["public", "private"]),
  rules: z.array(z.string().trim().max(LIMITS.ruleMax, "Keep each rule to 200 characters.")).max(LIMITS.rulesMax, "Ten rules at most."),
});

export async function createCommunity(input: z.input<typeof createSchema>): Promise<ActionResult<{ slug: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(createSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const base = slugFrom(parsed.data.name) || "community";
  const padded = base.length >= 3 ? base : `${base}-circle`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt === 0 ? padded : `${padded.slice(0, 56)}-${attempt + 1}`;
    const { data, error } = await who.db.rpc("circle_create_community", {
      p_name: parsed.data.name,
      p_slug: slug,
      p_description: parsed.data.description,
      p_category: parsed.data.category,
      p_visibility: parsed.data.visibility,
      p_rules: parsed.data.rules.filter((r) => r.length > 0),
      p_cover_path: null,
      p_area_id: null,
    });
    if (error) return fail(wordsFor(error));
    const outcome = readCreateOutcome(data);
    if (outcome.ok) {
      revalidatePath("/circle");
      return ok({ slug: outcome.slug });
    }
    if (outcome.reason === "taken") continue;
    if (outcome.reason === "phone") return { ok: false, error: "Confirm your phone before you start a community.", gate: "phone" };
    if (outcome.reason === "limit") return fail("You have started 3 communities this week. Try again next week.");
    if (outcome.reason === "signed_out") return fail(SIGNED_OUT_MESSAGE);
    return fail(FAILED);
  }
  return fail("That name is taken. Try a slightly different one.");
}

export async function joinCommunity(input: { communityId: string; slug: string }): Promise<ActionResult<{ status: "active" | "requested" }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(z.object({ communityId: uuid, slug: z.string() }), input);
  if (!parsed.ok) return fail(parsed.error);
  const { data, error } = await who.db.rpc("circle_join", { p_community: parsed.data.communityId });
  if (error) return fail(wordsFor(error));
  if (data !== "active" && data !== "requested") return fail(FAILED);
  revalidatePath(`/circle/c/${parsed.data.slug}`);
  revalidatePath("/circle");
  return ok({ status: data });
}

export async function leaveCommunity(input: { communityId: string; slug: string }): Promise<ActionResult<null>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(z.object({ communityId: uuid, slug: z.string() }), input);
  if (!parsed.ok) return fail(parsed.error);
  const { data, error } = await who.db.rpc("circle_leave", { p_community: parsed.data.communityId });
  if (error) return fail(wordsFor(error));
  if (data === "owner") return fail("You started this community, so it needs you. Hand it to a moderator before you leave.");
  if (data !== "left") return fail(FAILED);
  revalidatePath(`/circle/c/${parsed.data.slug}`);
  revalidatePath("/circle");
  return ok(null);
}

export async function decideJoinRequest(input: {
  communityId: string;
  userId: string;
  approve: boolean;
  slug: string;
}): Promise<ActionResult<{ outcome: "approved" | "declined" }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(z.object({ communityId: uuid, userId: uuid, approve: z.boolean(), slug: z.string() }), input);
  if (!parsed.ok) return fail(parsed.error);
  const { data, error } = await who.db.rpc("circle_decide_request", {
    p_community: parsed.data.communityId,
    p_user: parsed.data.userId,
    p_approve: parsed.data.approve,
  });
  if (error) return fail(wordsFor(error));
  if (data !== "approved" && data !== "declined") return fail(data === "not_allowed" ? "Only the people who run this community can answer requests." : FAILED);
  revalidatePath(`/circle/c/${parsed.data.slug}/manage`);
  return ok({ outcome: data });
}

/* ------------------------------------------------------------------ posts */

const postSchema = z.object({
  communityId: uuid,
  type: z.enum(["question", "discussion", "guide", "opportunity", "announcement"]),
  title: z.string().trim().min(LIMITS.titleMin, "Give it a short title.").max(LIMITS.titleMax, "Keep the title to 140 characters."),
  body: z.string().trim().max(LIMITS.bodyMax, "Keep it to 4,000 characters."),
  listingId: uuid.optional().nullable(),
});

export async function createCirclePost(input: z.input<typeof postSchema>): Promise<ActionResult<{ id: string; held: boolean }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(postSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const d = parsed.data;
  const { data, error } = await who.db
    .from("posts")
    .insert({
      author_id: who.userId,
      author_kind: "USER",
      kind: d.type === "question" ? "ASK" : "GIST",
      body: d.body.length > 0 ? d.body : d.title,
      title: d.title,
      community_id: d.communityId,
      circle_type: d.type,
      listing_id: d.listingId ?? null,
      status: "LIVE",
    })
    .select("id, status")
    .single();
  if (error || !data) return fail(wordsFor(error));
  revalidatePath("/circle");
  return ok({ id: (data as { id: string }).id, held: (data as { status: string }).status === "HELD" });
}

const replySchema = z.object({
  rootId: uuid,
  parentId: uuid,
  body: z.string().trim().min(1, "Write something first.").max(LIMITS.bodyMax, "Keep it to 4,000 characters."),
});

export async function replyInCircle(input: z.input<typeof replySchema>): Promise<ActionResult<{ id: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(replySchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { data, error } = await who.db
    .from("posts")
    .insert({ author_id: who.userId, author_kind: "USER", kind: "REPLY", body: parsed.data.body, parent_id: parsed.data.parentId, status: "LIVE" })
    .select("id")
    .single();
  if (error || !data) return fail(wordsFor(error));
  revalidatePath(`/circle/p/${parsed.data.rootId}`);
  return ok({ id: (data as { id: string }).id });
}

export async function setHelpful(input: { postId: string; rootId: string; on: boolean }): Promise<ActionResult<{ on: boolean }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(z.object({ postId: uuid, rootId: uuid, on: z.boolean() }), input);
  if (!parsed.ok) return fail(parsed.error);
  const { error } = parsed.data.on
    ? await who.db.from("post_helpful").upsert({ post_id: parsed.data.postId, user_id: who.userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true })
    : await who.db.from("post_helpful").delete().eq("post_id", parsed.data.postId).eq("user_id", who.userId);
  if (error) return fail(error.code === "42501" ? "You can mark someone else's answer as helpful, not your own." : wordsFor(error));
  revalidatePath(`/circle/p/${parsed.data.rootId}`);
  return ok({ on: parsed.data.on });
}

export async function acceptAnswer(input: { questionId: string; answerId: string | null }): Promise<ActionResult<{ acceptedId: string | null }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(z.object({ questionId: uuid, answerId: uuid.nullable() }), input);
  if (!parsed.ok) return fail(parsed.error);
  const { data, error } = await who.db.rpc("circle_accept_answer", { p_question: parsed.data.questionId, p_answer: parsed.data.answerId });
  if (error) return fail(wordsFor(error));
  if (data === "not_allowed") return fail("Only the person who asked can accept an answer.");
  if (data !== "accepted" && data !== "cleared") return fail(FAILED);
  revalidatePath(`/circle/p/${parsed.data.questionId}`);
  return ok({ acceptedId: data === "accepted" ? parsed.data.answerId : null });
}

export async function followQuestion(input: { questionId: string; on: boolean }): Promise<ActionResult<{ on: boolean }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(z.object({ questionId: uuid, on: z.boolean() }), input);
  if (!parsed.ok) return fail(parsed.error);
  const { error } = parsed.data.on
    ? await who.db.from("circle_question_follows").upsert({ question_id: parsed.data.questionId, user_id: who.userId }, { onConflict: "question_id,user_id", ignoreDuplicates: true })
    : await who.db.from("circle_question_follows").delete().eq("question_id", parsed.data.questionId).eq("user_id", who.userId);
  if (error) return fail(wordsFor(error));
  revalidatePath(`/circle/p/${parsed.data.questionId}`);
  return ok({ on: parsed.data.on });
}
