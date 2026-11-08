"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, validate, type ActionResult } from "@/lib/actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "@/lib/actions/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeInAppNotice } from "@/lib/notify/in-app";

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

async function communityInfo(db: Db, communityId: string): Promise<{ name: string; slug: string }> {
  try {
    const { data } = await db.from("circle_communities").select("name, slug").eq("id", communityId).single();
    const row = data as { name: string; slug: string } | null;
    return { name: row?.name ?? "a community", slug: row?.slug ?? "" };
  } catch { return { name: "a community", slug: "" }; }
}

function notifyCircle(userId: string, title: string, body: string, href: string): void {
  const admin = createAdminClient();
  writeInAppNotice(admin, { user_id: userId, kind: "social", title, body, href }).catch(() => {});
}

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

const updateCommunitySchema = z.object({
  communityId: uuid,
  slug: z.string(),
  name: z.string().trim().min(LIMITS.nameMin, "Give it a name of 3 letters or more.").max(LIMITS.nameMax, "Keep the name to 60 characters.").nullable(),
  description: z.string().trim().max(LIMITS.descriptionMax, "Keep the description to 500 characters.").nullable(),
  visibility: z.enum(["public", "private"]).nullable(),
  rules: z.array(z.string().trim().max(LIMITS.ruleMax, "Keep each rule to 200 characters.")).max(LIMITS.rulesMax, "Ten rules at most.").nullable(),
});

export async function updateCommunitySettings(input: z.input<typeof updateCommunitySchema>): Promise<ActionResult<null>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(updateCommunitySchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { data, error } = await who.db.rpc("circle_update_community", {
    p_community: parsed.data.communityId,
    p_name: parsed.data.name,
    p_description: parsed.data.description,
    p_visibility: parsed.data.visibility,
    p_rules: parsed.data.rules?.filter((r) => r.length > 0) ?? null,
  });
  if (error) return fail(wordsFor(error));
  if (data === "not_member") return fail("You are not a member of this community.");
  if (data === "not_allowed") return fail("Only the people who run this community can change its settings.");
  if (data === "bad_visibility") return fail("Visibility must be public or private.");
  if (data !== "ok") return fail(FAILED);
  revalidatePath(`/circle/c/${parsed.data.slug}`);
  revalidatePath("/circle");
  return ok(null);
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
  if (data === "approved") {
    const ci = await communityInfo(who.db, parsed.data.communityId);
    notifyCircle(
      parsed.data.userId,
      `You were accepted into ${ci.name}`,
      "You are now a member. Open it to see what is happening.",
      `/circle/c/${parsed.data.slug}`,
    );
  }
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

/* ---------------------------------------------------- community settings */

const updateSchema = z.object({
  communityId: uuid,
  slug: z.string(),
  name: z.string().trim().min(LIMITS.nameMin, "Give it a name of 3 letters or more.").max(LIMITS.nameMax, "Keep the name to 60 characters.").optional(),
  description: z.string().trim().max(LIMITS.descriptionMax, "Keep the description to 500 characters.").optional(),
  visibility: z.enum(["public", "private"]).optional(),
  rules: z.array(z.string().trim().max(LIMITS.ruleMax, "Keep each rule to 200 characters.")).max(LIMITS.rulesMax, "Ten rules at most.").optional(),
});

export async function updateCommunity(input: z.input<typeof updateSchema>): Promise<ActionResult<null>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(updateSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { data, error } = await who.db.rpc("circle_update_community", {
    p_community: parsed.data.communityId,
    p_name: parsed.data.name ?? null,
    p_description: parsed.data.description ?? null,
    p_visibility: parsed.data.visibility ?? null,
    p_rules: parsed.data.rules?.filter((r) => r.length > 0) ?? null,
  });
  if (error) return fail(wordsFor(error));
  if (data === "not_member") return fail("You are not a member of this community.");
  if (data === "not_allowed") return fail("Only the people who run this community can change its settings.");
  if (data === "bad_visibility") return fail("Visibility must be public or private.");
  if (data !== "ok") return fail(FAILED);
  revalidatePath(`/circle/c/${parsed.data.slug}`);
  revalidatePath(`/circle/c/${parsed.data.slug}/manage`);
  revalidatePath("/circle");
  return ok(null);
}

export async function removeMember(input: {
  communityId: string;
  userId: string;
  slug: string;
}): Promise<ActionResult<null>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(z.object({ communityId: uuid, userId: uuid, slug: z.string() }), input);
  if (!parsed.ok) return fail(parsed.error);
  const { data, error } = await who.db.rpc("circle_remove_member", {
    p_community: parsed.data.communityId,
    p_user: parsed.data.userId,
  });
  if (error) return fail(wordsFor(error));
  if (data === "not_member") return fail("That person is not a member.");
  if (data === "not_allowed") return fail("Only the people who run this community can remove members.");
  if (data !== "removed") return fail(FAILED);
  const ci = await communityInfo(who.db, parsed.data.communityId);
  notifyCircle(
    parsed.data.userId,
    `You were removed from ${ci.name}`,
    "A moderator removed you from the community.",
    "/circle",
  );
  revalidatePath(`/circle/c/${parsed.data.slug}`);
  revalidatePath(`/circle/c/${parsed.data.slug}/manage`);
  return ok(null);
}

/* ---------------------------------------------------------------- invites */

export async function sendCircleInvite(input: {
  communityId: string;
  inviteeId: string;
}): Promise<ActionResult<{ id: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(z.object({ communityId: uuid, inviteeId: uuid }), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  if (parsed.data.inviteeId === who.userId) return fail("You cannot invite yourself.");
  const { data, error } = await who.db
    .from("circle_invites")
    .insert({
      community_id: parsed.data.communityId,
      inviter_id: who.userId,
      invitee_id: parsed.data.inviteeId,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return fail("That person already has a pending invite to this community.");
    return fail(wordsFor(error));
  }
  const ci = await communityInfo(who.db, parsed.data.communityId);
  notifyCircle(
    parsed.data.inviteeId,
    `You were invited to join ${ci.name}`,
    "Open the invite to accept or decline.",
    ci.slug ? `/circle/c/${ci.slug}` : "/circle",
  );
  revalidatePath("/circle");
  return ok({ id: (data as { id: string }).id });
}

export async function acceptCircleInvite(input: { inviteId: string }): Promise<ActionResult<null>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(z.object({ inviteId: uuid }), input);
  if (!parsed.ok) return fail(parsed.error);
  const { data: invite } = await who.db
    .from("circle_invites")
    .select("inviter_id, community_id")
    .eq("id", parsed.data.inviteId)
    .single();
  const { error } = await who.db.rpc("accept_circle_invite", { p_invite_id: parsed.data.inviteId });
  if (error) return fail(wordsFor(error));
  if (invite) {
    const inv = invite as { inviter_id: string; community_id: string };
    const ci = await communityInfo(who.db, inv.community_id);
    notifyCircle(
      inv.inviter_id,
      `Your invite to ${ci.name} was accepted`,
      "The person you invited is now a member.",
      ci.slug ? `/circle/c/${ci.slug}` : "/circle",
    );
  }
  revalidatePath("/circle");
  return ok(null);
}

export async function declineCircleInvite(input: { inviteId: string }): Promise<ActionResult<null>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(z.object({ inviteId: uuid }), input);
  if (!parsed.ok) return fail(parsed.error);
  const { error } = await who.db.rpc("decline_circle_invite", { p_invite_id: parsed.data.inviteId });
  if (error) return fail(wordsFor(error));
  revalidatePath("/circle");
  return ok(null);
}

export async function withdrawCircleInvite(input: { inviteId: string }): Promise<ActionResult<null>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(z.object({ inviteId: uuid }), input);
  if (!parsed.ok) return fail(parsed.error);
  const { error } = await who.db
    .from("circle_invites")
    .update({ status: "withdrawn", decided_at: new Date().toISOString() })
    .eq("id", parsed.data.inviteId)
    .eq("inviter_id", who.userId)
    .eq("status", "pending");
  if (error) return fail(wordsFor(error));
  revalidatePath("/circle");
  return ok(null);
}

/* ------------------------------------------------------------------ plans */

const planSchema = z.object({
  communityId: uuid,
  title: z.string().trim().min(3, "Give it a title of 3 letters or more.").max(140, "Keep the title to 140 characters."),
  description: z.string().trim().max(2000, "Keep it to 2,000 characters."),
  maxMembers: z.number().int().min(2).max(100).nullable(),
  scheduledAt: z.string().nullable(),
  location: z.string().trim().max(200, "Keep the location to 200 characters.").nullable(),
});

export async function createCirclePlan(input: z.input<typeof planSchema>): Promise<ActionResult<{ id: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(planSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { data, error } = await who.db
    .from("circle_plans")
    .insert({
      community_id: parsed.data.communityId,
      organiser_id: who.userId,
      title: parsed.data.title,
      description: parsed.data.description,
      max_members: parsed.data.maxMembers,
      scheduled_at: parsed.data.scheduledAt,
      location: parsed.data.location,
    })
    .select("id")
    .single();
  if (error || !data) return fail(wordsFor(error));
  revalidatePath("/circle");
  return ok({ id: (data as { id: string }).id });
}

export async function updateCirclePlan(input: {
  planId: string;
  status: "completed" | "cancelled";
}): Promise<ActionResult<null>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(
    z.object({
      planId: uuid,
      status: z.enum(["completed", "cancelled"]),
    }),
    input,
  );
  if (!parsed.ok) return fail(parsed.error);
  const { error } = await who.db
    .from("circle_plans")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.planId);
  if (error) return fail(wordsFor(error));
  revalidatePath("/circle");
  return ok(null);
}

export async function signUpForPlan(input: { planId: string }): Promise<ActionResult<null>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(z.object({ planId: uuid }), input);
  if (!parsed.ok) return fail(parsed.error);
  const { error } = await who.db
    .from("circle_plan_signups")
    .insert({ plan_id: parsed.data.planId, user_id: who.userId });
  if (error) {
    if (error.code === "23505") return fail("You have already signed up for this plan.");
    return fail(wordsFor(error));
  }
  const { data: plan } = await who.db
    .from("circle_plans")
    .select("organiser_id, title, community_id")
    .eq("id", parsed.data.planId)
    .single();
  if (plan) {
    const p = plan as { organiser_id: string; title: string; community_id: string };
    if (p.organiser_id !== who.userId) {
      const ci = await communityInfo(who.db, p.community_id);
      notifyCircle(
        p.organiser_id,
        `Someone signed up for "${p.title}"`,
        "A member signed up for your plan.",
        ci.slug ? `/circle/c/${ci.slug}` : "/circle",
      );
    }
  }
  revalidatePath("/circle");
  return ok(null);
}

export async function withdrawFromPlan(input: { planId: string }): Promise<ActionResult<null>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(z.object({ planId: uuid }), input);
  if (!parsed.ok) return fail(parsed.error);
  const { error } = await who.db
    .from("circle_plan_signups")
    .delete()
    .eq("plan_id", parsed.data.planId)
    .eq("user_id", who.userId);
  if (error) return fail(wordsFor(error));
  revalidatePath("/circle");
  return ok(null);
}

/* --------------------------------------------------------- shared shortlists */

export async function shareShortlist(input: {
  communityId: string;
  collectionId: string;
  title: string;
  description: string;
}): Promise<ActionResult<{ id: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(
    z.object({
      communityId: uuid,
      collectionId: uuid,
      title: z.string().trim().min(1, "Give it a name.").max(120, "Keep the name to 120 characters."),
      description: z.string().trim().max(500, "Keep the description to 500 characters."),
    }),
    input,
  );
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { data, error } = await who.db
    .from("circle_shared_shortlists")
    .insert({
      community_id: parsed.data.communityId,
      collection_id: parsed.data.collectionId,
      shared_by: who.userId,
      title: parsed.data.title,
      description: parsed.data.description,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return fail("This collection is already shared in this community.");
    return fail(wordsFor(error));
  }
  revalidatePath("/circle");
  return ok({ id: (data as { id: string }).id });
}

export async function unshareShortlist(input: { shortlistId: string }): Promise<ActionResult<null>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(z.object({ shortlistId: uuid }), input);
  if (!parsed.ok) return fail(parsed.error);
  const { error } = await who.db
    .from("circle_shared_shortlists")
    .delete()
    .eq("id", parsed.data.shortlistId);
  if (error) return fail(wordsFor(error));
  revalidatePath("/circle");
  return ok(null);
}

/* ---------------------------------------------------------------- vouches */

export async function vouchForMember(input: {
  communityId: string;
  voucheeId: string;
  note: string;
}): Promise<ActionResult<{ id: string }>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(
    z.object({
      communityId: uuid,
      voucheeId: uuid,
      note: z.string().trim().max(280, "Keep the vouch to 280 characters."),
    }),
    input,
  );
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  if (parsed.data.voucheeId === who.userId) return fail("You cannot vouch for yourself.");
  const { data, error } = await who.db
    .from("circle_vouches")
    .insert({
      community_id: parsed.data.communityId,
      voucher_id: who.userId,
      vouchee_id: parsed.data.voucheeId,
      note: parsed.data.note,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return fail("You have already vouched for this person in this community.");
    return fail(wordsFor(error));
  }
  const ci = await communityInfo(who.db, parsed.data.communityId);
  notifyCircle(
    parsed.data.voucheeId,
    `Someone vouched for you in ${ci.name}`,
    "A member of the community vouched for you.",
    ci.slug ? `/circle/c/${ci.slug}` : "/circle",
  );
  revalidatePath("/circle");
  return ok({ id: (data as { id: string }).id });
}

export async function withdrawVouch(input: { vouchId: string }): Promise<ActionResult<null>> {
  const who = await member();
  if ("error" in who) return fail(who.error);
  const parsed = validate(z.object({ vouchId: uuid }), input);
  if (!parsed.ok) return fail(parsed.error);
  const { error } = await who.db
    .from("circle_vouches")
    .delete()
    .eq("id", parsed.data.vouchId)
    .eq("voucher_id", who.userId);
  if (error) return fail(wordsFor(error));
  revalidatePath("/circle");
  return ok(null);
}

/* ---------------------------------------------------------------- follows */

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
