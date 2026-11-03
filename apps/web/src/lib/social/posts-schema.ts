/**
 * posts-schema: the zod schemas the SERVER validates with.
 *
 * Everything a client component may import (the constants, labels, limits,
 * copy and pure helpers) lives in `./posts-model` and is re-exported here, so a server
 * module still imports from this file as before. A client component imports
 * the model, never this file, because this file builds zod schemas at import
 * time and zod's classic API is 64 KB gzipped in every client chunk that
 * reaches it (W13, chunk 2008felnqkn1d).
 */

import { z } from "zod";
import {
  COMPOSABLE_KINDS,
  POST_MAX,
  POST_MEDIA_MAX,
  REPORT_REASONS,
} from "./posts-model";
export * from "./posts-model";

/**
 * Attaching pictures to a post that already exists.
 *
 * The post is written first because the object path carries its id, which is
 * how `private.social_media_access` resolves a picture back to the post that
 * decides who may see it. A database trigger refuses any path that is not
 * `<author>/<post>/<file>`, so this schema checks the shape it can check and
 * the action checks the rest against the session it actually holds.
 */
export const attachMediaSchema = z.object({
  postId: z.string().uuid(),
  items: z
    .array(
      z.object({
        path: z.string().trim().min(3).max(400),
        width: z.number().int().positive().max(20_000).nullable(),
        height: z.number().int().positive().max(20_000).nullable(),
      }),
    )
    .min(1)
    .max(POST_MEDIA_MAX),
});

export const dropPostSchema = z.object({
  /**
   * Optional, and that is the whole point.
   *
   * A post used to REQUIRE a place, so the only way to say anything was to
   * join a room first, and the composer on the main feed showed "Join this
   * place first and you can post in it" to somebody who had opened the app to
   * write one sentence. Nothing in the database ever demanded it:
   * `posts.area_id` is nullable, `posts_insert_self` allows null outright and
   * `posts_select` shows it to everybody. The requirement existed in this line
   * and nowhere else.
   *
   * Omitted, the post is addressed to the whole platform and appears in every
   * feed that is not a single place's own.
   */
  areaId: z.string().uuid("Choose a place to post in.").optional(),
  kind: z.enum(COMPOSABLE_KINDS),
  body: z
    .string()
    .trim()
    .min(1, "Write something first.")
    .max(POST_MAX, `Keep it under ${POST_MAX} characters.`),
});

export const editPostSchema = z.object({
  postId: z.string().uuid(),
  body: z
    .string()
    .trim()
    .min(1, "A post cannot be empty. Delete it instead.")
    .max(POST_MAX, `Keep it under ${POST_MAX} characters.`),
});

export const replySchema = z.object({
  parentId: z.string().uuid(),
  body: z
    .string()
    .trim()
    .min(1, "Write your reply first.")
    .max(POST_MAX, `Keep it under ${POST_MAX} characters.`),
});

export const postIdSchema = z.object({ postId: z.string().uuid() });

export const markSchema = z.object({
  postId: z.string().uuid(),
  mark: z.enum(["LIKE", "SAVE"]),
  /** The state wanted (3 November 2026): a replay from the phone's outbox sets, never flips. */
  want: z.boolean().optional(),
});

const reasonEnum = z.enum(REPORT_REASONS);

export const reportPostSchema = z.object({
  postId: z.string().uuid(),
  reason: reasonEnum,
  detail: z.string().trim().max(600).optional().or(z.literal("")),
});

export const reportProfileSchema = z.object({
  userId: z.string().uuid(),
  reason: reasonEnum,
  detail: z.string().trim().max(600).optional().or(z.literal("")),
});

export const blockSchema = z.object({ userId: z.string().uuid() });

export const muteSchema = z.object({
  targetKind: z.enum(["USER", "POST", "AREA"]),
  targetId: z.string().uuid(),
});

/* ------------------------------------------------------------------ *
 * Copy, in one place, so a page and a toast cannot drift apart.
 * ------------------------------------------------------------------ */
