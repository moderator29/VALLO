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
import { getDictionary } from "@vallo/i18n";

const _s = getDictionary("en").social;

export const POST_KINDS = ["GIST", "ASK", "REPLY", "SHOWCASE", "SYSTEM"] as const;

export type PostKind = (typeof POST_KINDS)[number];

/** What a person may actually choose to write. The other two are the platform's. */
export const COMPOSABLE_KINDS = ["GIST", "ASK"] as const;

export type ComposableKind = (typeof COMPOSABLE_KINDS)[number];

/** SW11: source of truth is now `packages/i18n/src/locales/social.en.ts`. */
export const KIND_LABEL: Record<ComposableKind, string> = _s.postKindLabel as Record<ComposableKind, string>;
export const KIND_HINT: Record<ComposableKind, string> = _s.postKindHint as Record<ComposableKind, string>;
export const KIND_PLACEHOLDER: Record<ComposableKind, string> = _s.postKindPlaceholder as Record<ComposableKind, string>;

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

export const POST_COPY = _s.post;
export const POST_FAILURE = _s.postFailure;

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
