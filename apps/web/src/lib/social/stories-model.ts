import { socialStoryEn, socialStoryFailureEn } from "@vallo/i18n/en/social";

/**
 * Stories.
 *
 * Client safe, because both the composer and the viewer need these and a
 * constant exported from a `"use server"` file cannot be imported by a client
 * component. That failure only shows at build time, never at typecheck, and
 * this codebase has been caught by it before.
 *
 * **A story is not a post.** It was one for an afternoon, as
 * `post_kind = 'STORY'`, and that was wrong: it made a piece of writing into a
 * variant of a feed item. It now has its own table, its own reactions, its own
 * comments with their own likes, its own views, its own moderation and its own
 * counters:
 *
 *   `public.stories`                 the piece itself
 *   `public.story_reactions`         LIKE and SAVE
 *   `public.story_comments`          with `parent_id` for ONE level of nesting
 *   `public.story_comment_reactions` a like on a comment
 *   `public.story_views`             the same salted daily bucket posts use
 *
 * The single most important column is `image_path not null`. **The picture is
 * the story.** Making it a column rather than a second row is what removed the
 * deferred constraint trigger the previous shape needed, which failed at COMMIT
 * with an error no write path could see coming. One insert, one rule, no
 * deferral.
 *
 * **Comments are one level deep and the database enforces it.** A reply aimed
 * at a reply is silently re-pointed at its parent, so the sheet is built for
 * exactly two levels and can never receive a third. That is why the connector
 * it draws needs no depth arithmetic: a comment either has a parent in the
 * sheet or it does not.
 *
 * It is not ephemeral. Nothing expires it and nothing counts twenty-four hours.
 * A story here is an editorial piece with a headline, and the whole point is
 * that it is still there next month.
 */

import { DB_LIMIT_CODE, DB_LIMIT_MESSAGE } from "@/lib/security/db-limit";

/* No floor: the picture is the story; a caption of any length, or none (founder, 8 October 2026). */
export const STORY_HEADLINE_MIN = 0;

export const STORY_HEADLINE_MAX = 120;

export const STORY_STANDFIRST_MAX = 400;

export const STORY_PLACE_MAX = 80;

export const STORY_COMMENT_MAX = 1000;

/** The longest edge a story image is stored at. Full bleed on a phone, and
    still sensible on a laptop, without shipping a 4MB photograph over 3G. */

export const STORY_IMAGE_MAX_EDGE = 2048;

export const STORY_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** Where a story's picture lives. Private, read through the story's own
    visibility, exactly as post media is. */

export const STORY_BUCKET = "social-media";

/** SW11: source of truth is now `packages/i18n/src/locales/social.en.ts`. */
const _s = { story: socialStoryEn, storyFailure: socialStoryFailureEn };
export const STORY_COPY = _s.story;
export const STORY_FAILURE = _s.storyFailure;

/** The SQLSTATEs the story paths turn into sentences. */
export function messageForStoryError(code: string | undefined): string {
  switch (code) {
    case "42P01":
    case "PGRST205":
      return STORY_FAILURE.notYet;
    case "42501":
      return STORY_FAILURE.notInArea;
    case "23503":
      return STORY_FAILURE.gone;
    case "23514":
      return "That will not publish. Check the headline and try again.";
    case DB_LIMIT_CODE:
      return DB_LIMIT_MESSAGE;
    default:
      return STORY_FAILURE.down;
  }
}
