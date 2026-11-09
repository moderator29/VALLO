import { socialAreaEn, socialAreaFailureEn, socialAreaKindHintEn, socialAreaKindLabelEn } from "@vallo/i18n/en/social";

const _s = { area: socialAreaEn, areaFailure: socialAreaFailureEn, areaKindHint: socialAreaKindHintEn, areaKindLabel: socialAreaKindLabelEn };

/**
 * Around: the shapes and the words for places.
 *
 * Client safe on purpose. Everything a form or a card needs to import lives
 * here, and nothing here imports `server-only`, because a constant exported
 * from a `"use server"` file cannot be imported by a client component and the
 * failure only shows up at build time, never at typecheck.
 *
 * The database is the authority for every rule below. These schemas exist to
 * give a person a useful sentence before the round trip, not to be the check.
 * Where the two could ever disagree, the database wins.
 */

/** A place is one of four things, and the kind changes nothing but the label. */
export const AREA_KINDS = ["CITY", "AREA", "ESTATE", "CAMPUS"] as const;

export type AreaKind = (typeof AREA_KINDS)[number];

/** SW11: source of truth is now `packages/i18n/src/locales/social.en.ts`. */
export const AREA_KIND_LABEL: Record<AreaKind, string> = _s.areaKindLabel as Record<AreaKind, string>;
export const AREA_KIND_HINT: Record<AreaKind, string> = _s.areaKindHint as Record<AreaKind, string>;

export const AREA_STATUSES = [
  "PROPOSED",
  "ACTIVE",
  "PAUSED",
  "ARCHIVED",
  "REJECTED",
] as const;

export type AreaStatus = (typeof AREA_STATUSES)[number];

export const AREA_ROLES = ["MEMBER", "RESIDENT", "MODERATOR"] as const;

export type AreaRole = (typeof AREA_ROLES)[number];

/**
 * What a moderator may do, stated in the product rather than buried in a policy.
 * The owner's ruling, and the reason the word "admin" is not used for this role
 * anywhere a member can see: an area moderator is not a platform administrator
 * and must never be mistaken for one.
 */
export const MODERATOR_CAN = [
  "Hide a post while a person reviews it",
  "Welcome people and answer questions about the place",
  "Flag a listing or a profile to the Vallo team",
] as const;

export const MODERATOR_CANNOT = [
  "Delete anybody's post, ever",
  "Remove a member from the place",
  "See anyone's bookings, payments or messages",
] as const;

export const HANDLE_RE = /^[a-z][a-z0-9_]{2,19}$/;

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Turn a typed place name into a slug. Deliberately lossy and deliberately
 * boring: strip accents, keep letters and digits, collapse everything else to a
 * single hyphen. A person never sees this, and a slug that surprises its author
 * is a slug that gets reported as a bug.
 */
export function slugifyArea(city: string, name: string): string {
  const raw = `${city} ${name}`;
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/**
 * Forty words is the floor on a moderator application, and it is a real
 * threshold rather than a formality: somebody who will not write four sentences
 * about a place is not going to spend evenings looking after it. The database
 * carries the same bound, so this message is a courtesy, not the gate.
 */
export const MODERATOR_REASON_MIN = 40;

export const MODERATOR_REASON_MAX = 600;

export const AREA_COPY = _s.area;
export const AREA_FAILURE = _s.areaFailure;

/**
 * The rate limits, named once. The numbers are argued in
 * docs/SOCIAL_DESIGN.md section 8.4 and the limiter is the durable Postgres one,
 * which fails open by design, so these are a cost on abuse rather than a wall.
 */
export const AREA_LIMITS = {
  propose: { bucket: "social:propose-area", limit: 3, windowSeconds: 86_400 },
  /* Walking through a door is navigation, so the ceiling is set where a script
     hits it and a curious person never does. Somebody who opens sixty local
     governments in a day is exploring Nigeria; somebody who opens six hundred
     is not a person. */
  enter: { bucket: "social:enter-place", limit: 120, windowSeconds: 86_400 },
  join: { bucket: "social:join-area", limit: 20, windowSeconds: 86_400 },
  moderate: { bucket: "social:apply-moderate", limit: 3, windowSeconds: 86_400 },
} as const;
