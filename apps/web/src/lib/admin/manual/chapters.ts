import type { UiIconName } from "@/design-system/icons/UiIcon";
import type { StaffScope } from "@/lib/admin/guard";

/**
 * THE STAFF MANUAL, AS A LIST (DOCS_AND_PRESENCE_UPGRADE.md section 10).
 *
 * The chapters of the manual new staff read at `/admin/manual`: what each
 * desk is for and who opens it, how to work a queue, what a person may decide
 * alone, what is written down, and where to take what they cannot decide. The
 * words of each chapter live beside its route (`app/admin/manual/_chapters`);
 * this file is the index both the cards and the route read, so the two cannot
 * disagree about which chapters exist.
 *
 * Every statement in the chapters was read from the console's own code (the
 * guard, each desk's server actions, the database functions they call) on the
 * date below. When a desk changes, the chapter changes with it and the date
 * moves.
 *
 * Client-safe: data only.
 */

/** The day the chapters were last read against the code. */
export const MANUAL_UPDATED = "2026-11-10";

export const MANUAL_SLUGS = ["access", "desks", "queues", "decisions", "records", "escalation"] as const;
export type ManualSlug = (typeof MANUAL_SLUGS)[number];

export type ManualChapter = {
  slug: ManualSlug;
  number: number;
  title: string;
  icon: UiIconName;
  /** One sentence for the index card. */
  description: string;
};

export const MANUAL_CHAPTERS: readonly ManualChapter[] = [
  {
    slug: "access",
    number: 1,
    title: "Getting in, and who sees what",
    icon: "key",
    description: "How a staff account opens the console, the access areas a person can hold, and the named positions.",
  },
  {
    slug: "desks",
    number: 2,
    title: "What each desk is for",
    icon: "grid",
    description: "Every desk on the console, what it is for, and which access area opens it.",
  },
  {
    slug: "queues",
    number: 3,
    title: "Working a queue",
    icon: "clipboard-list",
    description: "Listings, identity checks, reports, support tickets, refunds and the other queues, step by step.",
  },
  {
    slug: "decisions",
    number: 4,
    title: "What you may decide alone",
    icon: "scale",
    description: "The decisions open to you, the ones that need a second person, and the ones only an admin takes.",
  },
  {
    slug: "records",
    number: 5,
    title: "What is written down, and what a member sees",
    icon: "history",
    description: "The audit log, what it records about your work, and what a member can read of a staff decision.",
  },
  {
    slug: "escalation",
    number: 6,
    title: "Escalation and out of hours",
    icon: "alert-triangle",
    description: "Where to take what you cannot decide, who answers for each area, and what to do out of hours.",
  },
];

export function isManualSlug(value: unknown): value is ManualSlug {
  return typeof value === "string" && (MANUAL_SLUGS as readonly string[]).includes(value);
}

export function manualChapter(slug: ManualSlug): ManualChapter {
  return MANUAL_CHAPTERS.find((chapter) => chapter.slug === slug) ?? MANUAL_CHAPTERS[0]!;
}

/** The chapters either side of one, for the previous and next links. */
export function manualNeighbours(slug: ManualSlug): { previous: ManualChapter | null; next: ManualChapter | null } {
  const index = MANUAL_CHAPTERS.findIndex((chapter) => chapter.slug === slug);
  return {
    previous: index > 0 ? MANUAL_CHAPTERS[index - 1]! : null,
    next: index >= 0 && index < MANUAL_CHAPTERS.length - 1 ? MANUAL_CHAPTERS[index + 1]! : null,
  };
}

/**
 * The access areas' names, as the console prints them. A copy of
 * `STAFF_SCOPE_LABEL` in `lib/admin/guard.ts`, which is server-only, so the
 * manual's words stay client-safe; `app/admin/manual/manual.test.ts` fails the
 * moment the two disagree.
 */
export const MANUAL_AREA_LABEL: Record<StaffScope, string> = {
  listing_approval: "Listing approval",
  kyc_review: "KYC review",
  moderation: "Reports and moderation",
  support: "Support",
  agreements: "Agreement approval",
  guarantee: "Guarantee claims",
  finance: "Finance",
  compliance: "Compliance",
  operations: "Operations",
  trust_safety: "Trust and Safety",
  roommates: "Roommates moderation",
  circle: "Circle moderation",
  analyst: "Read-only analyst",
};
