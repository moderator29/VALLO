"use server";

/**
 * Following, and unfollowing.
 *
 * One row in `public.follows` written through the person's OWN row level
 * security bound client. Three rules live in the database and none of them is
 * restated here, because a rule enforced in two places drifts in one of them:
 *
 *   `follows_insert_self` decides that the follower is you, that the followee
 *   has actually claimed a handle, and that neither of you has blocked the
 *   other. That last clause is `private.blocked_with`, which is bidirectional.
 *
 *   `follows_delete_self` decides that you may only ever remove your own
 *   follow.
 *
 *   `private.bump_follow_counts` maintains `follower_count` and
 *   `following_count` on both profiles. **Nothing in application code touches a
 *   count.** The number handed back to the surface is read again afterwards, in
 *   its own statement, because a statement cannot see the rows its own trigger
 *   has just written.
 *
 * The action takes a handle rather than a user id: a handle is the address the
 * person is looking at, and resolving it server side means a crafted form
 * cannot point a follow at somebody the viewer cannot even see.
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import {
  NOT_CONFIGURED_MESSAGE,
  resolveSession,
  SIGNED_OUT_MESSAGE,
} from "../actions/session";
import { consume, subjectForUser } from "../security/rate-limit";
import type { Database } from "../supabase/database.types";
import { handleSchema } from "./profiles-schema";
import { getFollowList, type FollowRow } from "./follows-queries";
import { SOCIAL_OFF_MESSAGE, isSocialEnabled } from "./flag";

/** 100 follows a day. Enough for anyone reading; not enough to farm a graph. */
const FOLLOW_LIMIT = 100;
const FOLLOW_WINDOW_SECONDS = 24 * 60 * 60;

const SERVICE_DOWN_MESSAGE =
  "We could not update that just now. Please try again in a moment.";

/**
 * The one sentence for a refusal the database made on safety grounds.
 *
 * It names the real reason without asserting which direction the block runs in,
 * because the viewer is only entitled to know one of those two answers and the
 * surface cannot tell which case it is in.
 */
const BLOCKED_MESSAGE =
  "This account cannot be followed. That happens when either of you has blocked the other.";

const GONE_MESSAGE =
  "That page is not available. The account may have been closed. Search for the person again.";

export type FollowOutcome = {
  handle: string;
  following: boolean;
  /** The follower count as the database holds it after the write, or null when
      it could not be read. Null means "keep the number you have". */
  followerCount: number | null;
};

const followInputSchema = z.object({ handle: handleSchema });

export async function toggleFollow(input: {
  handle: string;
  /** The state wanted. Given, a tap sets rather than flips (the outbox replays with it). */
  want?: boolean;
}): Promise<ActionResult<FollowOutcome>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);
  const want = typeof input?.want === "boolean" ? input.want : undefined;
  const parsed = validate(followInputSchema, input);
  if (!parsed.ok) return fail(GONE_MESSAGE);
  const { handle } = parsed.data;

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const { supabase, user } = session;

  /* A blocked profile is not returned by `social_profiles_select` at all, in
     either direction, so this read is also the block check. */
  const { data: target, error: targetError } = await supabase
    .from("social_profiles")
    .select("user_id")
    .eq("handle", handle)
    .maybeSingle();
  if (targetError) return fail(SERVICE_DOWN_MESSAGE);
  if (!target) return fail(GONE_MESSAGE);

  if (target.user_id === user.id) {
    return fail("You cannot follow yourself. Your own page is always yours.");
  }

  const { data: existing, error: readError } = await supabase
    .from("follows")
    .select("followee_id")
    .eq("follower_id", user.id)
    .eq("followee_id", target.user_id)
    .maybeSingle();
  if (readError) return fail(SERVICE_DOWN_MESSAGE);

  if (want !== undefined && Boolean(existing) === want) return settle(supabase, handle, target.user_id, want);

  if (existing) {
    /* Unfollowing is deliberately not metered. A limit that can trap somebody
       inside a follow they want out of is a limit working against the person it
       is meant to protect. */
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("followee_id", target.user_id);
    if (error) return fail(SERVICE_DOWN_MESSAGE);

    return settle(supabase, handle, target.user_id, false);
  }

  const verdict = await consume({
    bucket: "social_follow",
    subject: subjectForUser(user.id),
    limit: FOLLOW_LIMIT,
    windowSeconds: FOLLOW_WINDOW_SECONDS,
  });
  if (!verdict.allowed) {
    return fail(
      `You have followed ${FOLLOW_LIMIT} people today. You can follow more ${verdict.retryIn}.`,
    );
  }

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, followee_id: target.user_id });

  if (error) {
    /* 23505: already following, from another tab. The intent is satisfied. */
    if (error.code === "23505") return settle(supabase, handle, target.user_id, true);
    /* 42501: the policy refused it, which at this point means a block. */
    if (error.code === "42501") return fail(BLOCKED_MESSAGE);
    /* 23503: the account went away between the render and the tap. */
    if (error.code === "23503") return fail(GONE_MESSAGE);
    /* 23514: follows_not_self_chk, which the check above should have caught. */
    if (error.code === "23514")
      return fail("You cannot follow yourself. Your own page is always yours.");
    return fail(SERVICE_DOWN_MESSAGE);
  }

  return settle(supabase, handle, target.user_id, true);
}

/**
 * Read the count back and hand the surface the truth.
 *
 * A separate statement on purpose. The counter trigger fires after the write,
 * and every subquery inside one statement shares a snapshot, so asking for the
 * count in the same breath as the insert would return the number from before
 * it.
 *
 * A count we could not read comes back as null rather than as zero. Null lets
 * the button keep the number it already had until the page refreshes; zero
 * would be a confident lie about somebody's following.
 */
async function settle(
  supabase: SupabaseClient<Database>,
  handle: string,
  followeeId: string,
  following: boolean,
): Promise<ActionResult<FollowOutcome>> {
  /* No `revalidatePath` (Agent FEEL, 13 November 2026): in this Next it
     renders the whole current page into the action's answer and empties the
     client router cache. The button redraws the profile it is on itself
     (`router.refresh` in FollowButton), and only that one. */

  try {
    const { data, error } = await supabase
      .from("social_profiles")
      .select("follower_count")
      .eq("user_id", followeeId)
      .maybeSingle();
    if (error) return ok({ handle, following, followerCount: null });
    return ok({ handle, following, followerCount: data?.follower_count ?? null });
  } catch {
    return ok({ handle, following, followerCount: null });
  }
}

/* ------------------------------------------------------- reading, in pages */

const morePeopleSchema = z.object({
  handle: handleSchema,
  direction: z.enum(["followers", "following"]),
  /** The created_at of the last row already on screen. */
  before: z.string().min(1),
});

/**
 * The next page of a follower or following list.
 *
 * A read behind a server action rather than a link to `?before=`, because a
 * link would replace the rows already on screen with the next fifty and there
 * is no way back to the first page except the browser's own history. A list
 * that loses what you already scrolled past is a list nobody scrolls twice.
 *
 * It resolves through the same query the page itself uses, so a person reading
 * page four sees exactly what row level security would have shown them on page
 * one, and there is no second copy of the block rule to keep in step.
 */
export async function moreFollows(input: {
  handle: string;
  direction: "followers" | "following";
  before: string;
}): Promise<ActionResult<{ people: FollowRow[]; cursor: string | null }>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);
  const parsed = validate(morePeopleSchema, input);
  if (!parsed.ok) return fail(GONE_MESSAGE);

  const page = await getFollowList(
    parsed.data.handle,
    parsed.data.direction,
    parsed.data.before,
  );

  if (page.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (page.state === "missing") return fail(GONE_MESSAGE);

  return ok({ people: page.people, cursor: page.cursor });
}
