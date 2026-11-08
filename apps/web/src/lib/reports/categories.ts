/**
 * What a person can report, and what they can call it.
 *
 * Client-safe AND zod-free: imports nothing at all, so the report sheet can
 * render the same categories the action validates against (`schema.ts` builds
 * its enums from these very arrays and re-exports them), and neither can
 * drift. The validator used to live in this same module, which put the whole
 * of zod, about 62 KB gzipped, into the first load of every page carrying a
 * "Report this" link: the listing, the stay, the restaurant, the thread. The
 * same split as `lib/interests/property-types.ts` from its `schema.ts`.
 *
 * The list is deliberately short and deliberately concrete. A reporting form
 * with fifteen overlapping options gets "other" every time, and "other" is
 * exactly the free-text soup that made the reports queue unsortable in the
 * first place. Every code here is also a check constraint value on
 * public.reports, so an invented one is refused by the database as well.
 */

export const REPORT_CATEGORIES = [
  "off_platform_payment",
  "scam",
  "unsafe",
  "not_as_described",
  "unavailable",
  "offensive",
  "duplicate",
  "other",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/** SW11: source of truth is now `packages/i18n/src/locales/safety.en.ts`. */
import { safetyReportTargetNounEn, safetyReportsEn } from "@vallo/i18n/en/safety";
const _safety = { reports: safetyReportsEn, reportTargetNoun: safetyReportTargetNounEn };
export const REPORT_CATEGORY_COPY = _safety.reports as Record<ReportCategory, { label: string; hint: string }>;

/** The order the categories are offered in. Serious first, tidy last. */
export const REPORT_CATEGORY_ORDER: ReportCategory[] = [
  "off_platform_payment",
  "scam",
  "unsafe",
  "not_as_described",
  "unavailable",
  "offensive",
  "duplicate",
  "other",
];

/**
 * The kinds of thing this flow can report. Matches reports.target_type.
 *
 * `conversation` and `message` were added for the one place the product had
 * no report control at all: a one to one thread. Apple 1.2 and Play's user
 * generated content policy both want reporting ON DIRECT MESSAGING, which is
 * also the place on this platform where a person is most likely to need it.
 * `public.reports.target_type` is a plain `text` column with no check
 * constraint on the kind, so these two need no migration; the CATEGORY is the
 * constrained column and it is unchanged.
 *
 * STORE-P2-01: `review`, `business` (a stay or a restaurant; its id is the
 * accommodation or business id the page is keyed on) and `event` are public
 * user-generated surfaces too, and a store reviewer expects to be able to
 * report any of them.
 */
export const REPORT_TARGETS = [
  "listing",
  "conversation",
  "message",
  "review",
  "business",
  "event",
  /* Vallo Roommates (8 November 2026): a roommate post and a roommate profile. */
  "roommate_listing",
  "roommate_profile",
] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

/**
 * What the report sheet calls the thing it is reporting.
 *
 * The sheet used to say "Report this listing" in three places with the word
 * baked in, which is how a generic sheet ends up lying about a conversation.
 */
export const REPORT_TARGET_NOUN = _safety.reportTargetNoun as Record<ReportTarget, string>;

export const DETAILS_MAX = 1200;
