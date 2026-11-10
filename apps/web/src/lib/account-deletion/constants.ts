/**
 * The numbers and names the deletion flow is built on, in one file, with no
 * imports, so a test, a server action, a scheduled job, the marketing page and
 * the privacy document all read the same values.
 *
 * Nothing here is a secret and nothing here is a personal identifier.
 */

/** How long the account is deactivated before anything is destroyed. */
export const GRACE_WINDOW_DAYS = 30;

/**
 * Why somebody is leaving, as a closed list. Only the code is kept (in the
 * audit line), never free text: that table is readable by every admin, so it
 * carries machine-readable reasons and nothing a person typed.
 */
export const DELETION_REASONS = [
  "not_using",
  "found_place",
  "not_found",
  "hard_to_use",
  "notifications",
  "privacy",
  "safety",
  "second_account",
  "other",
  "prefer_not_to_say",
] as const;

export type DeletionReason = (typeof DELETION_REASONS)[number];

/** Typed in capitals, checked on the server, never translated. */
export const DELETE_CONFIRM_PHRASE = "DELETE MY ACCOUNT";

/**
 * The nine storage buckets, every one of which the purge sweeps.
 *
 * Eight are foldered by user id, which every upload path in the app writes and
 * every storage policy enforces. `message-attachments` is foldered by
 * CONVERSATION id, so its objects are found through the attachment rows
 * instead; it is in this list because the purge must still attempt it, and a
 * bucket left out of the list is a bucket nobody ever notices is full.
 */
export const STORAGE_BUCKETS = [
  "avatars",
  "social-covers",
  "social-media",
  "listing-photos",
  "listing-videos",
  "agent-documents",
  "host-documents",
  "accommodation-photos",
  "message-attachments",
] as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[number];

/** The eight the purge can sweep by prefix. */
export const USER_FOLDERED_BUCKETS: readonly StorageBucket[] = STORAGE_BUCKETS.filter(
  (bucket) => bucket !== "message-attachments",
);

/** How many objects one `remove` call carries. Supabase accepts more; this is kind to a cold function. */
export const STORAGE_REMOVE_BATCH = 100;

/** How many accounts one scheduled run purges. Deliberately small: each one is a long transaction. */
export const PURGE_BATCH_LIMIT = 10;

/** How many objects one directory listing returns before paging. */
export const STORAGE_LIST_PAGE = 100;

/**
 * How deep a bucket sweep will walk before giving up.
 *
 * Every path the app writes is `<uid>/<uuid>.<ext>` or
 * `<uid>/<uuid>/<kind>.<ext>`, so two levels below the person's folder covers
 * everything today and one spare level covers a path shape nobody has written
 * yet. A sweep that recursed without a bound would be a way to hang the job.
 */
export const STORAGE_MAX_DEPTH = 3;

/** The statuses a deletion request can hold. */
export type DeletionStatus = "SCHEDULED" | "CANCELLED" | "PURGING" | "PURGED";

/**
 * How many whole days are left in a grace window, never negative.
 *
 * Here rather than beside the screen that draws it, because the email, the
 * settings panel and the public page all say the same number and a second
 * implementation of a countdown is a second answer to one question.
 */
export function daysLeft(purgeAfter: string, now: number = Date.now()): number {
  const end = Date.parse(purgeAfter);
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, Math.ceil((end - now) / 86_400_000));
}
