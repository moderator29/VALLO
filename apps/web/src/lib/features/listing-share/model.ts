/**
 * SHARE TO FEED, THE PURE HALF (founder, 10 November 2026).
 *
 * Any signed-in member may share any public, live listing into the feed as a
 * post of their own, with an optional note. Two active shares per person,
 * platform-wide; a super admin has no limit. The database is the authority
 * (`private.listing_share_guard()` in `feed_listing_shares_2026-11-10.sql`
 * takes a per-user advisory lock before it counts); everything here exists so
 * a person gets a true sentence before the round trip, and so the server
 * action and the sheet agree on one set of numbers and words.
 *
 * Client safe: no server imports.
 */
import { listingShareEn } from "@vallo/i18n/en/listing-share";

export const LISTING_SHARE_LIMIT = 2;
export const LISTING_SHARE_NOTE_MAX = 280;

export const SHARE_WORDS = listingShareEn;

/** The SQLSTATEs the guard raises. */
export const SHARE_ERROR_CODES = {
  limit: "LS001",
  duplicate: "LS002",
  invalid: "LS003",
  notLive: "LS004",
} as const;

export type ShareSlots = {
  /** Active shares this person holds now. */
  used: number;
  limit: number;
  /** A super admin: no limit, `left` is null. */
  unlimited: boolean;
  /** Shares still free, or null when unlimited. */
  left: number | null;
};

export function slotsFrom(used: number, unlimited: boolean, limit: number = LISTING_SHARE_LIMIT): ShareSlots {
  const safeUsed = Number.isFinite(used) && used > 0 ? Math.floor(used) : 0;
  return {
    used: safeUsed,
    limit,
    unlimited,
    left: unlimited ? null : Math.max(0, limit - safeUsed),
  };
}

/** "You have 1 of 2 shares left", or the full and unlimited lines. */
export function slotsLine(slots: ShareSlots): string {
  if (slots.unlimited) return SHARE_WORDS.unlimited;
  if ((slots.left ?? 0) <= 0) return SHARE_WORDS.slotsNone.replace("{limit}", String(slots.limit));
  return SHARE_WORDS.slotsLeft.replace("{left}", String(slots.left)).replace("{limit}", String(slots.limit));
}

export function canShareMore(slots: ShareSlots): boolean {
  return slots.unlimited || (slots.left ?? 0) > 0;
}

/**
 * The note: plain text, one paragraph, at most 280 characters, no link and no
 * contact detail (the same rule the Circle cards hold). Empty is fine and
 * means no note.
 */
export function cleanNote(raw: string | null | undefined): { ok: true; note: string | null } | { ok: false; error: string } {
  const text = (raw ?? "")
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length === 0) return { ok: true, note: null };
  if ([...text].length > LISTING_SHARE_NOTE_MAX) return { ok: false, error: SHARE_WORDS.noteTooLong };
  if (/(https?:|www\.|@|[a-z0-9]\.(com|ng|net|org)\b)/i.test(text)) return { ok: false, error: SHARE_WORDS.noteLink };
  for (const run of text.match(/[0-9][0-9 ().+-]*[0-9]/g) ?? []) {
    if (run.replace(/[^0-9]/g, "").length >= 7) return { ok: false, error: SHARE_WORDS.noteLink };
  }
  return { ok: true, note: text };
}

export type ShareDecision = { allowed: true } | { allowed: false; reason: "signed-out" | "not-live" | "duplicate" | "limit" };

/**
 * May this person share this listing right now? The same rules the database
 * holds, in the order a person would want them said.
 */
export function decideShare(input: {
  signedIn: boolean;
  /** Published, open, not an example. */
  live: boolean;
  alreadyShared: boolean;
  slots: ShareSlots;
}): ShareDecision {
  if (!input.signedIn) return { allowed: false, reason: "signed-out" };
  if (!input.live) return { allowed: false, reason: "not-live" };
  if (input.alreadyShared) return { allowed: false, reason: "duplicate" };
  if (!canShareMore(input.slots)) return { allowed: false, reason: "limit" };
  return { allowed: true };
}

export function wordsForReason(reason: Extract<ShareDecision, { allowed: false }>["reason"]): string {
  switch (reason) {
    case "signed-out":
      return SHARE_WORDS.signInPrompt;
    case "not-live":
      return SHARE_WORDS.notLive;
    case "duplicate":
      return SHARE_WORDS.alreadyShared;
    case "limit":
      return SHARE_WORDS.limitReached;
  }
}

/** A database refusal as one true sentence, or null when it is not ours. */
export function wordsForDbCode(code: string | undefined | null): string | null {
  switch (code) {
    case SHARE_ERROR_CODES.limit:
      return SHARE_WORDS.limitReached;
    case SHARE_ERROR_CODES.duplicate:
    case "23505":
      return SHARE_WORDS.alreadyShared;
    case SHARE_ERROR_CODES.notLive:
    case SHARE_ERROR_CODES.invalid:
      return SHARE_WORDS.notLive;
    default:
      return null;
  }
}

/** What a feed card says about itself. */
export const SHARE_CARD_WORDS = {
  badge: SHARE_WORDS.badge,
  gone: SHARE_WORDS.gone,
  goneNote: SHARE_WORDS.goneNote,
  view: SHARE_WORDS.viewLabel,
} as const;
