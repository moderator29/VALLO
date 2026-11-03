"use server";

/**
 * Around: the write paths for posts.
 *
 * Everything here runs through the caller's own RLS-bound client. Nothing holds
 * the service role, because nothing needs to: the policies already decide who
 * may post, reply, mark, repost and remove, and a security definer path would
 * only be somewhere to get those rules wrong a second time.
 *
 * The database does the work these actions would otherwise duplicate. Depth and
 * root are computed by trigger, the scanner holds a post carrying an account
 * number before it is ever visible, a showcase is refused unless the listing is
 * PUBLISHED and owned by the author, and counters are maintained by trigger. So
 * these functions are thin on purpose: validate, rate limit, insert, and turn a
 * SQLSTATE into one true sentence.
 */

import { oncePerTap, tapKey } from "../offline/replay-guard";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import {
  NOT_CONFIGURED_MESSAGE,
  SIGNED_OUT_MESSAGE,
  resolveSession,
} from "../actions/session";
import { setupExempt } from "../actions/setup-exempt";
import { consume, retryIn, subjectForUser } from "../security/rate-limit";
import {
  POST_FAILURE,
  POST_LIMITS,
  attachMediaSchema,
  dropPostSchema,
  editPostSchema,
  markSchema,
  muteSchema,
  postIdSchema,
  replySchema,
  reportPostSchema,
  reportProfileSchema,
} from "./posts-schema";
import { SOCIAL_OFF_MESSAGE, isSocialEnabled } from "./flag";
import { SOCIAL_REPORT_KIND } from "./report-kinds";
import { getAreaFeed, getEverywhereFeed, getFriendsFeed, getJoinedFeed, type FeedPage } from "./posts-queries";
import { parseFeedCursor } from "./posts-cursor";
import { blockUserSafely, unblockUserSafely } from "../safety/blocks-actions";
import { DB_LIMIT_CODE, DB_LIMIT_MESSAGE, dbLimitRefusal } from "@/lib/security/db-limit";

function paced(seconds: number): string {
  return `You have done that a few times already. Try again ${retryIn(seconds)}.`;
}

/**
 * Turn a database refusal into a sentence a person can act on.
 *
 * The custom SQLSTATEs come from the placement trigger, which is the only place
 * that knows why a reply could not be placed. Mapping them here rather than
 * showing a generic failure is the difference between "try again" and "reply
 * higher up so people can follow it".
 */
function messageForPostError(code: string | undefined, fallback: string): string {
  switch (code) {
    case "RM010":
      return POST_FAILURE.gone;
    case "RM011":
      return "You cannot reply to a post that has been removed or held.";
    case "RM012":
      return POST_FAILURE.tooDeep;
    case "RM013":
      return "You can only showcase a listing of your own that is live.";
    case "42501":
      return POST_FAILURE.notInArea;
    case "23514":
      return "That will not post. Check the length and try again.";
    case DB_LIMIT_CODE:
      return DB_LIMIT_MESSAGE;
    default:
      return fallback;
  }
}

/**
 * Post into a place, or to the whole platform.
 *
 * Leaving `areaId` out is the ordinary case now rather than an error. See the
 * note on `dropPostSchema`: nothing in the database ever required a place, and
 * demanding one meant the first thing a new person was asked to do was join a
 * room before they could say anything at all.
 */
export async function dropPost(input: {
  areaId?: string;
  kind: "GIST" | "ASK";
  body: string;
  /** V-40: the UUID minted when this was tapped; a replay answers with the first post. */
  tapKey?: string;
}): Promise<ActionResult<{ postId: string; held: boolean }>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);
  const { tapKey: rawKey, ...fields } = input;
  const parsed = validate(dropPostSchema, fields);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  return oncePerTap("outbox.post", session.user.id, tapKey(rawKey), () => dropPostWork(session, parsed.data));
}

async function dropPostWork(
  session: Extract<Awaited<ReturnType<typeof resolveSession>>, { state: "signed-in" }>,
  input: z.infer<typeof dropPostSchema>,
): Promise<ActionResult<{ postId: string; held: boolean }>> {
  const parsed = { data: input };

  const subject = subjectForUser(session.user.id);
  for (const limit of [POST_LIMITS.post, POST_LIMITS.postDaily]) {
    const verdict = await consume({ ...limit, subject });
    if (!verdict.allowed) return fail(paced(verdict.retryAfterSeconds));
  }

  const { data, error } = await session.supabase
    .from("posts")
    .insert({
      area_id: parsed.data.areaId ?? null,
      author_id: session.user.id,
      author_kind: "USER",
      kind: parsed.data.kind,
      body: parsed.data.body,
    })
    // status comes back so the composer can tell the truth about what happened
    // rather than saying "posted" for something the scanner has just held.
    .select("id, status")
    .single();

  if (error || !data) {
    return fail(messageForPostError(error?.code, POST_FAILURE.down));
  }

  revalidatePath("/around");
  return ok({ postId: data.id, held: data.status === "HELD" });
}

/** Reply to a post, or to a reply, or to the AI. All the same path. */
export async function replyToPost(input: {
  parentId: string;
  body: string;
}): Promise<ActionResult<{ postId: string; held: boolean }>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);
  const parsed = validate(replySchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const verdict = await consume({
    ...POST_LIMITS.reply,
    subject: subjectForUser(session.user.id),
  });
  if (!verdict.allowed) return fail(paced(verdict.retryAfterSeconds));

  // area_id, root_id and depth are all filled in by the placement trigger from
  // the parent, so a client cannot claim a depth or move a reply between places.
  const { data, error } = await session.supabase
    .from("posts")
    .insert({
      parent_id: parsed.data.parentId,
      author_id: session.user.id,
      author_kind: "USER",
      kind: "REPLY",
      body: parsed.data.body,
    })
    .select("id, status, root_id")
    .single();

  if (error || !data) {
    return fail(messageForPostError(error?.code, POST_FAILURE.down));
  }

  revalidatePath(`/post/${data.root_id ?? parsed.data.parentId}`);
  return ok({ postId: data.id, held: data.status === "HELD" });
}

/**
 * The pictures on a post, once the post exists.
 *
 * This is deliberately a second call rather than a field on `dropPost`, and the
 * reason is the object's path. `private.social_media_access` resolves a picture
 * back to its post out of the second folder segment of the object name, so the
 * path has to be `<author>/<post>/<file>` and the post id therefore has to be
 * known before anything is uploaded. The order is: write the post, upload, then
 * this. A database trigger refuses any other shape, so a future surface that
 * gets the order wrong fails loudly rather than storing an unreadable picture.
 *
 * The bytes never come through here. They go straight from the device to the
 * bucket, re-encoded on the way, which is both how the location tag is stripped
 * and how four photographs avoid the one megabyte a server action accepts.
 *
 * No separate rate limit. A picture cannot exist without a post, and posting is
 * already limited at five an hour and twenty a day.
 */
export async function attachPostMedia(input: {
  postId: string;
  items: { path: string; width: number | null; height: number | null }[];
}): Promise<ActionResult<{ attached: number }>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);
  const parsed = validate(attachMediaSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  /* The same rule the trigger enforces, checked here against the session this
     process actually holds rather than against anything the client said. The
     trigger is the authority; this is so the refusal is a sentence instead of a
     SQLSTATE. */
  const prefix = `${session.user.id}/${parsed.data.postId}/`;
  if (parsed.data.items.some((item) => !item.path.startsWith(prefix))) {
    return fail(POST_FAILURE.pictureUpload);
  }

  const { error } = await session.supabase.from("post_media").insert(
    parsed.data.items.map((item, index) => ({
      post_id: parsed.data.postId,
      storage_path: item.path,
      width: item.width,
      height: item.height,
      position: index,
    })),
  );

  if (error) {
    /* The cap is the database's: `position between 0 and 3`, unique per post.
       Everything else here is a refusal the person cannot act on, so it gets
       the one sentence that is true of all of them. */
    if (error.code === "23514" || error.code === "23505") {
      return fail(POST_FAILURE.pictureTooMany);
    }
    return fail(POST_FAILURE.pictureUpload);
  }

  revalidatePath("/around");
  revalidatePath(`/post/${parsed.data.postId}`);
  return ok({ attached: parsed.data.items.length });
}

/**
 * Like, or save. One toggle for both, because they are the same shape: a row
 * that is either there or not. The current state is read from the database
 * rather than trusted from the client, so a double tap or a stale tab cannot
 * desynchronise it.
 */
export async function toggleMark(input: {
  postId: string;
  mark: "LIKE" | "SAVE";
  /** The state wanted. Given, a tap sets rather than flips, so a replay or a second tab cannot undo it. */
  want?: boolean;
}): Promise<ActionResult<{ marked: boolean }>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);
  const parsed = validate(markSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { postId, mark, want } = parsed.data;

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(POST_FAILURE.signedOutLike);

  const verdict = await consume({
    ...POST_LIMITS.mark,
    subject: subjectForUser(session.user.id),
  });
  if (!verdict.allowed) return fail(paced(verdict.retryAfterSeconds));

  const { data: existing } = await session.supabase
    .from("post_reactions")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", session.user.id)
    .eq("mark", mark)
    .maybeSingle();

  if (want !== undefined && Boolean(existing) === want) return ok({ marked: want });

  if (existing) {
    const { error } = await session.supabase
      .from("post_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", session.user.id)
      .eq("mark", mark);
    if (error) return fail(POST_FAILURE.down);
    return ok({ marked: false });
  }

  const { error } = await session.supabase
    .from("post_reactions")
    .insert({ post_id: postId, user_id: session.user.id, mark });

  if (error) {
    // A second tap from a stale tab is not worth an error message.
    if (error.code === "23505") return ok({ marked: true });
    if (error.code === "42501") return fail(POST_FAILURE.gone);
    return fail(POST_FAILURE.down);
  }
  return ok({ marked: true });
}

/** Repost, or undo one. */
export async function toggleRepost(input: {
  postId: string;
  /** The state wanted. Given, a tap sets rather than flips (the outbox replays with it). */
  want?: boolean;
}): Promise<ActionResult<{ reposted: boolean }>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);
  const want = typeof input?.want === "boolean" ? input.want : undefined;
  const parsed = validate(postIdSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const verdict = await consume({
    ...POST_LIMITS.repost,
    subject: subjectForUser(session.user.id),
  });
  if (!verdict.allowed) return fail(paced(verdict.retryAfterSeconds));

  const { data: existing } = await session.supabase
    .from("post_reposts")
    .select("post_id")
    .eq("post_id", parsed.data.postId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (want !== undefined && Boolean(existing) === want) return ok({ reposted: want });

  if (existing) {
    const { error } = await session.supabase
      .from("post_reposts")
      .delete()
      .eq("post_id", parsed.data.postId)
      .eq("user_id", session.user.id);
    if (error) return fail(POST_FAILURE.down);
    return ok({ reposted: false });
  }

  // The area the post came from rides along, so a repost can be attributed to
  // the place it was lifted out of rather than losing that context.
  const { data: post } = await session.supabase
    .from("posts")
    .select("area_id")
    .eq("id", parsed.data.postId)
    .maybeSingle();

  const { error } = await session.supabase.from("post_reposts").insert({
    post_id: parsed.data.postId,
    user_id: session.user.id,
    area_id: post?.area_id ?? null,
  });

  if (error) {
    if (error.code === "23505") return ok({ reposted: true });
    if (error.code === "42501") return fail(POST_FAILURE.gone);
    return fail(POST_FAILURE.down);
  }
  return ok({ reposted: true });
}

/**
 * Change what you wrote, inside the window.
 *
 * Three things the database does here that this file deliberately does not.
 *
 * `posts_update_own` allows an update only on your own post and only while it is
 * LIVE, and its WITH CHECK allows a body change only for fifteen minutes after
 * the post was written. `EDIT_WINDOW_MINUTES` is that number written down for
 * the surface, never the check.
 *
 * `guard_post_update` sets `edited_at` itself whenever the body changes, and
 * pins every count, every id and `created_at` to their old values. So this
 * writes the body and nothing else: setting `edited_at` from here would be
 * overwritten anyway, and setting anything else would be silently ignored,
 * which is far worse than being refused.
 *
 * `posts_scan` fires on UPDATE as well as INSERT, so an edit that introduces an
 * account number is held exactly as a new post carrying one would be. An edit
 * window with no rescan is a hole straight through moderation, and this one is
 * not that.
 *
 * **Two refusals, two different answers.** The window now lives in WITH CHECK
 * rather than in USING, so a stale edit raises 42501 instead of quietly
 * returning nothing, and a post that is not LIVE returns no row at all. Both
 * were one sentence before, and one of them was the wrong sentence.
 */
export async function editPost(input: {
  postId: string;
  body: string;
}): Promise<ActionResult<{ held: boolean }>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);
  const parsed = validate(editPostSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const verdict = await consume({
    ...POST_LIMITS.edit,
    subject: subjectForUser(session.user.id),
  });
  if (!verdict.allowed) return fail(paced(verdict.retryAfterSeconds));

  const { data, error } = await session.supabase
    .from("posts")
    .update({ body: parsed.data.body })
    .eq("id", parsed.data.postId)
    .eq("author_id", session.user.id)
    .select("id, status");

  /* The WITH CHECK refusal, which is what a stale edit is now. Ahead of the
     shared mapper, because that reads 42501 on this table as "you are not in
     this place", which is true of an insert and never true of this. */
  if (error?.code === "42501") return fail(POST_FAILURE.editWindowClosed);
  if (error) return fail(messageForPostError(error.code, POST_FAILURE.down));
  if (!data || data.length === 0) return fail(POST_FAILURE.editNotLive);

  revalidatePath("/around");
  return ok({ held: data[0]?.status === "HELD" });
}

/**
 * Delete your own post.
 *
 * A delete rather than a status change, so the row genuinely goes. Replies
 * survive: `posts.parent_id` cascades, so this would take a whole thread with
 * it, which would delete other people's words. Instead the body is emptied and
 * the status set to REMOVED, leaving a tombstone the thread can hang off.
 *
 * That is why this is an update and not a delete, despite the name. A real
 * delete is only correct for a post nobody has replied to, and checking that
 * first would be a race; the tombstone is right in both cases.
 *
 * **There is no window on this any more, and there should never have been one.**
 * Because removal is an update, `posts_update_own` used to apply the fifteen
 * minutes meant for editing to it as well, so a post an hour old could not be
 * taken down by the person who wrote it and the copy sent them to support to
 * ask. Both plans put the window on the edit alone. It matters more now that a
 * post can carry a photograph of the street somebody lives on. The window moved
 * into WITH CHECK, where it can tell an edit from a tombstone, and the database
 * deletes the `post_media` rows as the status lands so the pictures stop being
 * readable by anybody at all.
 *
 * A HELD post still cannot be taken down here, and that is deliberate rather
 * than left over: nobody but its author and a moderator can see it, and it is
 * mid-review. The zero-row answer is that case and it now says so.
 */
export async function removePost(input: {
  postId: string;
}): Promise<ActionResult<null>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);
  const parsed = validate(postIdSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  /*
   * The rows come back, and that is not decoration.
   *
   * PostgREST answers a policy refusal with an empty set and no error, so this
   * once returned success for a post that was still sitting there: the card
   * vanished from the list and the next refresh brought it back. Asking for the
   * ids back is what turns that silence into a sentence, and the one refusal
   * left is a post that is HELD rather than LIVE.
   *
   * `removed_at` is sent and the database derives its own from the transition,
   * so this line is a courtesy rather than the record.
   */
  const { data, error } = await session.supabase
    .from("posts")
    .update({
      status: "REMOVED",
      body: null,
      payload: null,
      removed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.postId)
    .eq("author_id", session.user.id)
    .select("id");

  if (error) return fail(POST_FAILURE.down);
  if (!data || data.length === 0) return fail(POST_FAILURE.deleteWhileHeld);

  revalidatePath("/around");
  revalidatePath(`/post/${parsed.data.postId}`);
  return ok(null);
}

/** Record that a post was seen. Never stores who saw it. */
export async function recordView(input: {
  postId: string;
}): Promise<ActionResult<null>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);
  const parsed = validate(postIdSchema, input);
  if (!parsed.ok) return ok(null);

  const session = await resolveSession();
  if (session.state !== "signed-in") return ok(null);

  // We send a post id and nothing else. A BEFORE INSERT trigger computes the
  // viewer bucket from auth.uid() as a salted daily hash, so no identifier ever
  // travels through this call and a client cannot choose, forge or replay one.
  // Yesterday's salt is deleted, which is what makes yesterday's buckets
  // permanently unlinkable to a person.
  //
  // A repeat view on the same day collides on the primary key, which is the
  // point: one person counts once a day, and the collision IS the success. So
  // it is never reported, and a view is never something a reader has to be
  // told about.
  //
  // It is now a DO NOTHING rather than a swallowed error, and that is not
  // cosmetic. As a plain insert, every second look at a post raised
  // "duplicate key value violates unique constraint post_views_pkey", which
  // Postgres writes to the error log and PostgREST answers with a 409. So the
  // ordinary act of scrolling past something twice filled the database's error
  // log with the sound of the system working correctly, and cost a failed round
  // trip to do it. Those entries were also the loudest thing in the log while a
  // real 500 was being chased, which is exactly the cost of routine noise.
  //
  // `ignoreDuplicates` sends `Prefer: resolution=ignore-duplicates`, which
  // becomes ON CONFLICT DO NOTHING and needs no named constraint, so the
  // trigger that computes the viewer bucket is untouched.
  await session.supabase
    .from("post_views")
    .upsert({ post_id: parsed.data.postId } as never, { ignoreDuplicates: true });
  return ok(null);
}

/** Report a post into the queue the console already works. */
export async function reportPost(input: {
  postId: string;
  reason: string;
  detail?: string;
}): Promise<ActionResult<null>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);
  const parsed = validate(reportPostSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const verdict = await consume({
    ...POST_LIMITS.report,
    subject: subjectForUser(session.user.id),
  });
  if (!verdict.allowed) return fail(paced(verdict.retryAfterSeconds));

  // public.reports.target_type is already text, so a social target needs no
  // migration at all. Lower case, like every other kind (report-kinds.ts):
  // the notify trigger links a `post` report to the post.
  const { error } = await session.supabase.from("reports").insert({
    reporter_id: session.user.id,
    target_type: SOCIAL_REPORT_KIND.post,
    target_id: parsed.data.postId,
    reason: parsed.data.detail
      ? `${parsed.data.reason}: ${parsed.data.detail}`
      : parsed.data.reason,
  });

  /* One open report per person per target is a unique index; a second tap
     is the report already filed, which is the outcome they wanted, not a
     failure to show them. */
  if (error?.code === "23505") return ok(null);
  if (error) return fail(dbLimitRefusal(error) ?? POST_FAILURE.down);
  return ok(null);
}

/**
 * Report an account, rather than one thing it wrote.
 *
 * A separate target type, into the same queue the console already works, and
 * deliberately a separate action rather than a mode on `reportPost`. The two
 * carry different ids into different rows, and a single function taking "a post
 * or a person" is exactly the polymorphism the whole data model was designed to
 * avoid.
 *
 * `public.reports.target_type` is already `text`, so this needs no migration.
 * It shares `reportPost`'s rate limit bucket on purpose: twenty reports a day
 * is a person raising real problems, and the way somebody abuses this is by
 * reporting the same account from a menu over and over, which a per-kind budget
 * would happily allow.
 */
export async function reportProfile(input: {
  userId: string;
  reason: string;
  detail?: string;
}): Promise<ActionResult<null>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);
  const parsed = validate(reportProfileSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  if (parsed.data.userId === session.user.id) {
    return fail("You cannot report your own account.");
  }

  const verdict = await consume({
    ...POST_LIMITS.report,
    subject: subjectForUser(session.user.id),
  });
  if (!verdict.allowed) return fail(paced(verdict.retryAfterSeconds));

  const { error } = await session.supabase.from("reports").insert({
    reporter_id: session.user.id,
    target_type: SOCIAL_REPORT_KIND.profile,
    target_id: parsed.data.userId,
    reason: parsed.data.detail
      ? `${parsed.data.reason}: ${parsed.data.detail}`
      : parsed.data.reason,
  });

  /* One open report per person per target is a unique index; a second tap
     is the report already filed, which is the outcome they wanted, not a
     failure to show them. */
  if (error?.code === "23505") return ok(null);
  if (error) return fail(dbLimitRefusal(error) ?? POST_FAILURE.down);
  return ok(null);
}

/*
 * BLOCKING MOVED OUT, AND WHY THE NAMES STAYED HERE.
 *
 * `blockUser` and `unblockUser` used to be written out below, and both opened
 * with the `isSocialEnabled()` guard every other action in this file opens
 * with. That guard is right for a post and wrong for a block: a person being
 * harassed inside a listing conversation was refused the control because a
 * DIFFERENT feature was switched off. The implementation now lives in
 * `lib/safety/blocks-actions.ts` with no feature flag in front of it, and
 * these two re-exports keep every existing import in the social layer working
 * against that one implementation rather than a second copy.
 */
/*
 * WRAPPED, NOT RE-EXPORTED, AND THE DIFFERENCE TOOK PRODUCTION DOWN ONCE.
 *
 * This was `export { blockUserSafely as blockUser, ... } from "../safety/..."`,
 * and a re-export STATEMENT in a `"use server"` module is refused outright by
 * Turbopack: "Only async functions are allowed to be exported in a `use server`
 * file". It does not fail in isolation either. The module then compiles with NO
 * EXPORTS AT ALL, so every importer fails to resolve, and four components on
 * the social spine went down together with fifty eight errors from one line.
 * `next build` was red on main from the moment it landed. The same fault took
 * production down on 19 September, and the lint rule's own message names
 * that date.
 *
 * The distinction that matters, because it is subtle and it is the one people
 * get wrong: a `"use server"` module MAY DECLARE types and MAY import whatever
 * it likes. What it may not do is EXPORT anything that is not an async
 * function, and `export ... from` is an export statement whatever sits on the
 * other side of it. So the import moves to the top of the file and these two
 * become real async functions that call through.
 *
 * The reasoning that put them here is unchanged and is good: `blockUser` used
 * to open with the `isSocialEnabled()` guard every other action in this file
 * opens with, which is right for a post and WRONG FOR A BLOCK, because a person
 * being harassed inside a listing conversation was refused the control on the
 * grounds that a different feature was switched off. The implementation lives
 * in `lib/safety/blocks-actions.ts` with no flag in front of it, and these two
 * keep every existing import in the social layer pointing at that one
 * implementation rather than a second copy.
 */
export async function blockUser(input: { userId: string }): Promise<ActionResult<null>> {
  return blockUserSafely(input);
}

export async function unblockUser(input: { userId: string }): Promise<ActionResult<null>> {
  return unblockUserSafely(input);
}

/** Mute. One way silence: they are not told, and you stay visible to them. */
export async function muteTarget(input: {
  targetKind: "USER" | "POST" | "AREA";
  targetId: string;
}): Promise<ActionResult<null>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);
  const parsed = validate(muteSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const { error } = await session.supabase.from("mutes").insert({
    user_id: session.user.id,
    target_kind: parsed.data.targetKind,
    target_id: parsed.data.targetId,
  });

  if (error && error.code !== "23505") return fail(POST_FAILURE.down);
  revalidatePath("/around");
  return ok(null);
}

export async function unmuteTarget(input: {
  targetKind: "USER" | "POST" | "AREA";
  targetId: string;
}): Promise<ActionResult<null>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);
  const parsed = validate(muteSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(SIGNED_OUT_MESSAGE);

  const { error } = await session.supabase
    .from("mutes")
    .delete()
    .eq("user_id", session.user.id)
    .eq("target_kind", parsed.data.targetKind)
    .eq("target_id", parsed.data.targetId);

  if (error) return fail(POST_FAILURE.down);
  revalidatePath("/around");
  return ok(null);
}

/* ------------------------------------------------------------ feed paging */

/**
 * Which timeline a page continues. The same three reads `/around` makes,
 * named so the client cannot ask for one the page did not start with.
 */
export type FeedMode =
  | { kind: "everywhere" }
  | { kind: "joined" }
  | { kind: "friends" }
  | { kind: "area"; areaId: string };

const feedModeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("everywhere") }),
  z.object({ kind: z.literal("joined") }),
  z.object({ kind: z.literal("friends") }),
  z.object({ kind: z.literal("area"), areaId: z.uuid() }),
]);

/**
 * A feed cursor names the exact row the last page stopped on: its instant and
 * its id. `parseFeedCursor` in `posts-queries` owns the shape (and still
 * accepts a bare instant minted by an older deployment), so there is one
 * definition of what a cursor is and this only has to say yes or no.
 */
const feedCursorSchema = z.string().refine((value) => parseFeedCursor(value) !== null);

const ENDED: FeedPage = { posts: [], cursor: null, ended: true };

/**
 * The next page of a timeline, for a load-more control or a sentinel.
 *
 * The server cursors have existed since the feed was built and nothing ever
 * consumed them, so every timeline rendered its first twenty posts and
 * stopped. This is the missing half: hand back the `cursor` a page returned
 * and get the rows before it, through the same three reads the page made,
 * under the same RLS-bound client. A cursor that is not a cursor, or a mode
 * that names a place that is not a uuid, is refused as one honest sentence
 * rather than passed to Postgres.
 *
 * "joined" resolves the viewer from the session rather than from the client,
 * so nobody can page through another person's places: signed out it is an
 * ended page, which is exactly what `getJoinedFeed` answers for a stranger.
 */
/* B-2: read-only (or an exit the finish-setup hold never blocks), so it runs
   with the hold lifted. See lib/actions/setup-exempt.ts. */
export async function loadMoreFeed(
  ...args: Parameters<typeof loadMoreFeedInner>
): Promise<Awaited<ReturnType<typeof loadMoreFeedInner>>> {
  return setupExempt(() => loadMoreFeedInner(...args));
}

async function loadMoreFeedInner(
  cursor: string | null,
  mode: FeedMode = { kind: "everywhere" },
): Promise<ActionResult<FeedPage>> {
  if (!(await isSocialEnabled())) return fail(SOCIAL_OFF_MESSAGE);

  const parsedMode = validate(feedModeSchema, mode);
  if (!parsedMode.ok) return fail("That timeline could not be identified. Reload the feed.");

  // No cursor means the feed said it had ended, and the honest answer to
  // "more?" is the same ended page, never a second copy of the first one.
  if (cursor === null || cursor === undefined || cursor.length === 0) return ok(ENDED);
  const parsedCursor = feedCursorSchema.safeParse(cursor);
  if (!parsedCursor.success) return fail("That page could not be found. Reload the feed.");

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  /*
   * A SIGNED-OUT CALLER GETS NOTHING, AND THAT IS ITEM 8 REACHING THE ACTIONS.
   *
   * `/around` and `/post/[id]` are behind the gate from 23 September, so no
   * signed-out person has a feed to continue. This function is still
   * reachable by one, because a server action is posted to a PAGE'S path and
   * a caller may choose a path the gate leaves open: closing the screens
   * without closing this would leave the whole public timeline pageable by
   * anybody who read the action id out of the landing page's payload. A gate
   * that only redirects page requests while the data still answers is a
   * curtain.
   *
   * It is an ended page rather than a refusal, exactly as the "joined" branch
   * below has always answered a stranger, because the caller is a load-more
   * control and "there is no more" is the one answer it knows how to draw.
   * RLS is unchanged and is still what decides which rows a signed-in reader
   * may have.
   */
  if (session.state !== "signed-in") return ok(ENDED);

  const at = parsedCursor.data;
  const chosen = parsedMode.data;
  try {
    const page =
      chosen.kind === "area"
        ? await getAreaFeed(chosen.areaId, at)
        : chosen.kind === "joined"
          ? await getJoinedFeed(session.user.id, at)
          : chosen.kind === "friends"
            ? await getFriendsFeed(session.user.id, at)
            : await getEverywhereFeed(at);
    /* A dropped read is a failure the control can say and retry, never the
       end of the timeline. */
    if (page.failed) return fail("The next page did not load. Check your connection and try again.");
    return ok(page);
  } catch {
    return fail("The next page did not load. Pull to refresh and try again.");
  }
}
