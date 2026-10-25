/**
 * Around: the shapes and words for posts.
 *
 * Client safe. A constant exported from a `"use server"` file cannot be
 * imported by a client component, and the failure only shows at build time,
 * never at typecheck, so everything a form or a card needs lives here.
 *
 * The database is the authority for every bound below. These schemas exist so a
 * person gets a useful sentence before the round trip, not to be the check.
 */

export const POST_KINDS = ["GIST", "ASK", "REPLY", "SHOWCASE", "SYSTEM"] as const;

export type PostKind = (typeof POST_KINDS)[number];

/** What a person may actually choose to write. The other two are the platform's. */
export const COMPOSABLE_KINDS = ["GIST", "ASK"] as const;

export type ComposableKind = (typeof COMPOSABLE_KINDS)[number];

export const KIND_LABEL: Record<ComposableKind, string> = {
  GIST: "Say something",
  ASK: "Ask a question",
};

export const KIND_HINT: Record<ComposableKind, string> = {
  GIST: "Anything worth knowing about the place.",
  ASK: "Something you want an answer to. People who know the area will see it.",
};

export const KIND_PLACEHOLDER: Record<ComposableKind, string> = {
  GIST: "What is happening?",
  ASK: "What do you want to know?",
};

export const POST_MAX = 2000;

export const POST_MEDIA_MAX = 4;

/** The window the database allows an edit in. Kept in step with posts_update_own. */
export const EDIT_WINDOW_MINUTES = 15;

/* ------------------------------------------------------------------ *
 * Pictures.
 *
 * `post_media.position` is `smallint check (position between 0 and 3)` and
 * unique per post, so four is the database's rule and `POST_MEDIA_MAX` is this
 * side of the same number rather than the number itself. A fifth picture is
 * refused by the check constraint whatever the client believes.
 *
 * Every picture is re-encoded on the device before it is uploaded, which is why
 * the stored type is always JPEG and the accepted types are only what a canvas
 * can decode. The edge and the ceiling match a story's, because both end up in
 * the same private bucket and a person choosing a photo should not have to
 * learn two different limits.
 * ------------------------------------------------------------------ */

export const POST_IMAGE_MAX_EDGE = 2048;

export const POST_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const POST_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** The private bucket both a post's pictures and a story's live in. */
export const POST_MEDIA_BUCKET = "social-media";

/*
 * Reporting.
 *
 * `public.reports.reason` is text, so this list is our own decision rather than
 * a database constraint. It is still an enum here, because a triage queue where
 * every row says "Something else" cannot be worked, and free text as the only
 * signal is exactly what produces that queue.
 *
 * One vocabulary, two subsets. A post can be nothing to do with the place it
 * was written in; an account cannot. An account can be pretending to be
 * somebody; a single post rarely is on its own. Offering a reason that cannot
 * apply is how a report ends up filed as the nearest wrong thing.
 */
export const REPORT_REASONS = [
  "SCAM",
  "OFF_PLATFORM_PAYMENT",
  "HARASSMENT",
  "MISLEADING",
  "IMPERSONATION",
  "NOT_ABOUT_THIS_PLACE",
  "OTHER",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/* Their words are the reader's: `experienceSocial.feed.report.reasons`. */

/** What you may say about a post. */
export const POST_REPORT_REASONS: readonly ReportReason[] = [
  "SCAM",
  "OFF_PLATFORM_PAYMENT",
  "HARASSMENT",
  "MISLEADING",
  "NOT_ABOUT_THIS_PLACE",
  "OTHER",
];

/** What you may say about an account. */
export const PROFILE_REPORT_REASONS: readonly ReportReason[] = [
  "SCAM",
  "OFF_PLATFORM_PAYMENT",
  "HARASSMENT",
  "IMPERSONATION",
  "OTHER",
];

export const POST_COPY = {
  held:
    "This mentions something we check by hand. Somebody is reading it before it goes up, and only you can see it until then.",
  removed: "This post was removed.",
  /* Only ever shown when there actually are some. It was one sentence with the
     line above it and nothing read it, which meant a tombstone with no replies
     under it still promised replies. */
  removedReplies: "The replies under it are still here.",
  emptyFeed:
    "Nothing has been said here yet. What you say will be the first thing anybody arriving reads.",
  emptyFeedSignedOut: "Nothing has been said here yet.",
  endOfSession: "That is everything for today.",
  blockedDone:
    "Blocked. You will not see each other anywhere on Vallo, and they are not told.",
  /*
   * Precise on purpose, and it now matches every place a mute actually acts.
   *
   * Feeds, the story rail, what somebody has been up to on anybody else's page,
   * and their replies inside a thread, which collapse to one line with a way to
   * open them. The one place it deliberately does not act is their own page,
   * because going there is a deliberate act and hiding a person from the page
   * you asked for is not silence, it is a broken link.
   *
   * It is one way, so nothing about the reader changes for them. The sentence
   * used to promise total silence while the row was read by nothing at all,
   * which is a promise the product had no way of knowing it was breaking.
   */
  mutedDone:
    "Muted. They stop showing up in your feeds, stories and threads. Their own page still opens, and they are not told.",
  reportedDone:
    "Thank you. Somebody will look at this. We do not tell them who reported it.",
  copied: "Link copied.",
  /* ---------------------------------------------------------- pictures */
  picturePrompt: "Add a picture",
  /*
   * Said once, on the composer, because it is the reason the wait exists.
   * A camera photo carries EXIF and on a phone that usually includes the
   * coordinates of where it was taken, which for a photo of your own street is
   * your address. Every picture is redrawn on the device before it leaves it,
   * so the tag cannot survive.
   */
  pictureNote: "Up to four. Each one is redrawn on your phone first, so the location tag your camera wrote never leaves it.",
  pictureNeedsWords:
    "Say something about it and you can post. A picture on its own has no place to land.",
  pictureRemove: "Remove this picture",
  /*
   * The post is written before the picture is uploaded, because the object's
   * path carries the post's id. So the one honest thing to say when an upload
   * fails is that the words are already up and the picture is not.
   */
  pictureLost:
    "Your words are up. The picture did not reach us, so the post has none yet.",
  deleteConfirm:
    "Delete this post? Replies under it stay, with a note where it was.",
  editedDone: "Changed. It says edited from now on.",
  editHeld:
    "Your change mentions something we check by hand, so the post is with us while somebody reads it. Only you can see it until then.",
} as const;

export const POST_FAILURE = {
  down: "We could not do that just now. Please try again in a moment.",
  gone: "That post is no longer there. It may have been taken down. Refresh the feed.",
  notInArea: "Join this place before you post in it.",
  tooDeep:
    "This thread is as deep as it goes. Reply higher up so people can follow it.",
  /*
   * The window belongs to the edit and to nothing else.
   *
   * These two sentences used to say the same thing, because removal is an
   * UPDATE and `posts_update_own` applied the edit window to it as well. So a
   * post an hour old could not be taken down by the person who wrote it, and
   * this told them to write to support and ask. That is fixed in
   * `taking_a_post_down_is_not_the_edit_window_s_business`: the window moved
   * into WITH CHECK where it can tell an edit from a tombstone, and taking your
   * own words down has no clock on it at all.
   *
   * What is left is the one refusal that is real, and it is not about time.
   */
  editWindowClosed:
    "The fifteen minutes for changing a post has passed. What is written stays as it is, and you can take it down whenever you like.",
  editNotLive: "This post is not showing, so there is nothing to change on it.",
  deleteWhileHeld:
    "This one is still with a moderator, so it cannot be taken down from here yet. Nobody else can see it while it is with them.",
  signedOutLike: "Sign in to like this.",
  /* ---------------------------------------------------------- pictures */
  pictureType: "Choose a JPG, PNG or WebP picture.",
  pictureTooBig: "That picture is over 10MB. Please choose a smaller one.",
  /*
   * The refusal, not a fallback. Uploading the original file instead would
   * publish whatever the camera wrote into it, and asking somebody for another
   * picture is a far smaller cost than publishing where they live.
   */
  pictureReencode:
    "We could not prepare that picture safely on this device, so it was not uploaded. Try a different one.",
  pictureTooMany: "Four pictures is the most a post can carry. Remove one and try again.",
  pictureUpload: "That upload did not go through. Check your connection and try again.",
} as const;

/**
 * Rate limits. The numbers are argued in docs/SOCIAL_DESIGN.md section 8.4, and
 * the limiter is the durable Postgres one, which fails open by design, so these
 * price abuse rather than wall it off.
 */
export const POST_LIMITS = {
  post: { bucket: "social:post", limit: 5, windowSeconds: 3600 },
  postDaily: { bucket: "social:post-day", limit: 20, windowSeconds: 86_400 },
  reply: { bucket: "social:reply", limit: 10, windowSeconds: 300 },
  /* Generous. Somebody fixing a typo twice is not abuse, and the fifteen
     minute window already bounds how long this can be done for at all. */
  edit: { bucket: "social:edit", limit: 30, windowSeconds: 3600 },
  mark: { bucket: "social:mark", limit: 200, windowSeconds: 86_400 },
  repost: { bucket: "social:repost", limit: 30, windowSeconds: 86_400 },
  report: { bucket: "social:report", limit: 20, windowSeconds: 86_400 },
  block: { bucket: "social:block", limit: 50, windowSeconds: 86_400 },
} as const;
