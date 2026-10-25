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

export const STORY_COPY = {
  chip: "STORY",
  publishing: "Publishing",
  publish: "Publish story",
  headlinePlaceholder: "What happened?",
  standfirstPlaceholder: "The paragraph under the headline. Two sentences is plenty.",
  placePlaceholder: "Lekki Phase 1, Lagos",
  imagePrompt: "Choose the picture",
  imageNote:
    "Pictures are re-encoded on your phone before they are uploaded, so the location tag a camera writes never leaves it.",
  needsImage: "Choose a picture and it will publish. A caption is optional.",
  held:
    "Your story mentions something we check by hand. Somebody is reading it before it goes up, and only you can see it until then.",
  emptyMine:
    "A story is a picture, a headline and a line or two. It stays up, so it is worth writing the ones people will still want next month.",
  addComment: "Add a comment...",
  updates: "Updates",
  stories: "Stories",
  removed: "This story was removed.",
} as const;

export const STORY_FAILURE = {
  down: "We could not publish that just now. Please try again in a moment.",
  upload: "That upload did not go through. Check your connection and try again.",
  reencode:
    "We could not prepare that picture safely, so it was not uploaded. Try a different one.",
  tooBig: "That picture is over 10MB. Please choose a smaller one.",
  wrongType: "Choose a JPG, PNG or WebP picture.",
  notInArea: "Join this place before you write a story about it.",
  gone: "That story is no longer there. It may have been taken down. Refresh to see the ones still up.",
  /*
   * 42P01 is "no such table", which is the honest answer while the migration is
   * on its way. It is a platform state, not something the person did, and it
   * says so rather than blaming them or claiming a network problem.
   */
  notYet:
    "We cannot reach stories right now. Everything else you can do here works as normal.",
  signedOutLike: "Sign in to like this story.",
} as const;

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
