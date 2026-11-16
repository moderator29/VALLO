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
export const MANUAL_UPDATED = "2026-11-16";

export const MANUAL_SLUGS = ["access", "desks", "queues", "decisions", "records", "escalation", "my-desk", "weekly-report", "marketing", "content", "technical", "support-lead", "business-development", "social-media", "product-guide", "onboarding-a-lister", "onboarding-a-member", "copilot", "money", "offers-and-deals"] as const;
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
  {
    slug: "my-desk",
    number: 7,
    title: "My desk, tasks and announcements",
    icon: "user",
    description: "Your personal workspace: who you are here, your tasks, the announcements sent to you, and where to ask for help.",
  },
  {
    slug: "weekly-report",
    number: 8,
    title: "Weekly report",
    icon: "clipboard-list",
    description: "Your report each week: when the form opens, what to write, what is filled in for you, how to add proof, and what a reviewer does.",
  },
  {
    slug: "marketing",
    number: 9,
    title: "Marketing Manager",
    icon: "price-tag",
    description: "Campaigns, tracked links, results, acquisition and referral figures, briefs and the monthly report, for the Marketing Manager.",
  },
  {
    slug: "content",
    number: 10,
    title: "Content Manager",
    icon: "file-text",
    description: "The editorial calendar, approvals, requests, style and SEO checklists, translations and help gaps, for the Content Manager.",
  },
  {
    slug: "technical",
    number: 11,
    title: "Technical Administrator",
    icon: "sliders",
    description: "Reading platform health and errors, the incident log, runbooks, reminders and reviews, for the Technical Administrator.",
  },
  {
    slug: "support-lead",
    number: 12,
    title: "Customer Support Lead",
    icon: "headset",
    description: "Running the team, escalations, quality reviews and coaching, the support figures, and replies and policy, for the Customer Support Lead.",
  },
  {
    slug: "business-development",
    number: 13,
    title: "Business Development Director",
    icon: "hand-coins",
    description: "Getting to your desks, keeping every prospect in the pipeline step by step, the stages, follow-ups, the spreadsheet download and listing review.",
  },
  {
    slug: "social-media",
    number: 14,
    title: "Social Media Manager",
    icon: "camera",
    description: "The content calendar, a post from draft to posted, approval, the media library, what a post may say and the report.",
  },
  {
    slug: "product-guide",
    number: 15,
    title: "Vallo, feature by feature",
    icon: "compass",
    description: "What Vallo is, every feature, what it gives a business and a person, what it costs, what is open today, and what to say when you are asked.",
  },
  /* The two onboarding chapters (the founder, 15 November 2026): the subjects
     grew too big for a section of chapter 15 and each is now its own chapter,
     read from the real flows rather than from the documents about them. */
  {
    slug: "onboarding-a-lister",
    number: 16,
    title: "Onboarding a lister, end to end",
    icon: "id-card",
    description: "Every door onto the supply side: what each kind of lister gives, how long each step takes, what the reviewer looks at, what happens when something is missing, and the words to use when asking a business for their papers.",
  },
  {
    slug: "onboarding-a-member",
    number: 17,
    title: "Onboarding a member",
    icon: "user-check",
    description: "What a new member does and sees from sign up to their first booking, what Vallo asks them for and when, and what staff can see and do about each part of it.",
  },
  /* The copilot (the founder, 16 November 2026): every desk has one, it does
     desk work on cards a person presses, and it has history, settings and
     quick commands. Added at the end so no earlier chapter number moves. */
  {
    slug: "copilot",
    number: 18,
    title: "The AI copilot",
    icon: "bot",
    description: "Opening it, reading an answer, quick commands, history and settings, how a card works, the desk work it can do, the super admin's powers, and what it never does.",
  },
  /* The old staff manual at /admin/handbook/manual was retired (the founder,
     16 November 2026). What it said that no chapter held yet moved here: the
     money desks and the Offers and deals desk became chapters of their own,
     added at the end so no earlier chapter number moves. */
  {
    slug: "money",
    number: 19,
    title: "Working the money desks",
    icon: "coins",
    description: "The rules about money that never bend, deciding a disputed payment the partner holds, working a chargeback, changing a fee rate, and destroying records past retention.",
  },
  {
    slug: "offers-and-deals",
    number: 20,
    title: "The Offers and deals desk",
    icon: "scale",
    description: "Offers on homes for sale: the overview figures and what each means, the deals table, reading a deal, the three things staff may do, and what to say to a member.",
  },
];

/**
 * WHERE THE RETIRED STAFF MANUAL'S PAGES WENT. The old manual lived at
 * `/admin/handbook/manual/<page>`; each of its nine pages now redirects to
 * the chapter (and section) that holds what it said. An address not listed
 * here goes to the index. `app/admin/manual/manual.test.ts` checks every
 * target is a real chapter and a real section.
 */
export const RETIRED_MANUAL_PAGES: Readonly<Record<string, string>> = {
  "desks-and-access": "/admin/manual/access",
  "identity-and-applications": "/admin/manual/queues#identity",
  "listings-and-supply": "/admin/manual/queues#listings",
  "agreements-and-bookings": "/admin/manual/queues#agreements",
  "money-and-fees": "/admin/manual/money",
  "cases-and-safety": "/admin/manual/queues#reports",
  "support-desk": "/admin/manual/queues#tickets",
  "offers-and-deals-desk": "/admin/manual/offers-and-deals",
  "operations-and-tools": "/admin/manual/desks#take-care",
};

/** The address a retired manual page now lives at; the index for anything unknown. */
export function retiredManualTarget(page: string): string {
  return Object.hasOwn(RETIRED_MANUAL_PAGES, page) ? RETIRED_MANUAL_PAGES[page]! : "/admin/manual";
}

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
  business_development: "Business development",
  social_media: "Social media",
  marketing: "Marketing",
  content: "Content",
  technical: "Technical",
  support_lead: "Support lead",
};
