import type { StaffScope } from "../guard";

/**
 * ESCALATIONS FOR EVERY ADMIN DESK: THE RULES, AS PLAIN DATA (15 November 2026).
 *
 * Any member of staff can escalate what they cannot or may not decide. This
 * file is the one place the app states the rules: the kinds of issue, how
 * urgent each can be and its response time, where each kind goes (the routing
 * table), what a status means, and who may take which action on a record.
 *
 * The database enforces every one of these itself
 * (`supabase/migrations/pending/staff_escalations_2026-11-15.sql`). The
 * routing table, the fallback and the response times live in both places, and
 * `types.test.ts` reads the SQL and fails if the two drift, the way
 * `staff-positions.test.ts` pins the scope bundles.
 *
 * Client-safe: data and pure functions only. The scope keys come from
 * `lib/admin/guard.ts` as a type, never as a value, because that file is
 * server-only.
 */

/* ------------------------------------------------------------- categories */

export const ESCALATION_CATEGORIES = [
  "identity_fraud",
  "money",
  "safety",
  "listing",
  "technical",
  "policy_decision",
  "staff_access",
  "member_complaint",
  "other",
] as const;
export type EscalationCategory = (typeof ESCALATION_CATEGORIES)[number];

export function isEscalationCategory(value: unknown): value is EscalationCategory {
  return typeof value === "string" && (ESCALATION_CATEGORIES as readonly string[]).includes(value);
}

export const CATEGORY_LABEL: Record<EscalationCategory, { name: string; covers: string }> = {
  identity_fraud: { name: "Identity or fraud", covers: "An ID that looks false, two accounts for one person, a suspected scam." },
  money: { name: "Money", covers: "A payment, refund, payout or fee that looks wrong or that you may not decide." },
  safety: { name: "Safety", covers: "A threat, harassment, or anybody who may be in danger." },
  listing: { name: "A listing", covers: "A listing that may be false, copied, or needs a decision above yours." },
  technical: { name: "Something is broken", covers: "A page, a job or a tool that is not working." },
  policy_decision: { name: "A policy decision", covers: "The rules do not cover it, or an exception is being asked for." },
  staff_access: { name: "Staff access", covers: "Somebody needs access added, changed or taken away." },
  member_complaint: { name: "A member complaint", covers: "A complaint about Vallo or about how a case was handled." },
  other: { name: "Something else", covers: "Anything that does not fit the list above." },
};

/** The two kinds where a careless word could warn the person being looked at. */
export const NO_TIP_OFF_CATEGORIES: readonly EscalationCategory[] = ["identity_fraud", "safety"];

/* ------------------------------------------------------------- severities */

export const ESCALATION_SEVERITIES = ["low", "normal", "high", "urgent"] as const;
export type EscalationSeverity = (typeof ESCALATION_SEVERITIES)[number];

export function isEscalationSeverity(value: unknown): value is EscalationSeverity {
  return typeof value === "string" && (ESCALATION_SEVERITIES as readonly string[]).includes(value);
}

/** The response clock, in hours. Mirrors `private.staff_escalation_window`. */
export const DUE_HOURS: Record<EscalationSeverity, number> = { urgent: 1, high: 4, normal: 24, low: 72 };

export const SEVERITY_LABEL: Record<EscalationSeverity, { name: string; when: string; answer: string }> = {
  urgent: { name: "Urgent", when: "Harm or loss is happening now.", answer: "within 1 hour" },
  high: { name: "High", when: "It will get worse today if nobody acts.", answer: "within 4 hours" },
  normal: { name: "Normal", when: "It needs a decision, and it can wait a day.", answer: "within 24 hours" },
  low: { name: "Low", when: "No rush. A question or something to tidy up.", answer: "within 3 days" },
};

/** When an escalation raised now is due. */
export function dueAt(severity: EscalationSeverity, fromMs: number): Date {
  return new Date(fromMs + DUE_HOURS[severity] * 3_600_000);
}

/**
 * The window an overdue escalation gets when it moves up a level: half the
 * original, never under an hour. Mirrors `staff_escalation_bump_overdue`.
 */
export function bumpWindowHours(severity: EscalationSeverity): number {
  return Math.max(DUE_HOURS[severity] / 2, 1);
}

/* ------------------------------------------------------------------ routes */

/** Where an escalation can go: a team (a staff scope), the COO or the super admin. */
export type EscalationRoute = StaffScope | "coo" | "super_admin";

/**
 * Every route, in plain words that finish the sentence "This goes to ...".
 * Typed by `StaffScope`, so a scope added to the console without a name here
 * does not compile.
 */
export const ROUTE_LABEL: Record<EscalationRoute, string> = {
  listing_approval: "the Listings team",
  kyc_review: "the Verification team",
  moderation: "the Moderation team",
  support: "the Support team",
  agreements: "the Agreements team",
  guarantee: "the Guarantee claims team",
  finance: "the Finance team",
  compliance: "the Compliance team",
  operations: "the Operations team",
  trust_safety: "Trust and Safety",
  roommates: "the Roommates moderation team",
  circle: "the Circle moderation team",
  analyst: "the analysts",
  business_development: "the Business development team",
  social_media: "the Social media team",
  marketing: "the Marketing team",
  content: "the Content team",
  technical: "the Technical team",
  support_lead: "the Support lead",
  coo: "the COO",
  super_admin: "the super admin",
};

export function isEscalationRoute(value: unknown): value is EscalationRoute {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ROUTE_LABEL, value);
}

/** A route's name at the start of a sentence: "The Finance team", "Trust and Safety". */
export function routeName(route: string): string {
  const label = isEscalationRoute(route) ? ROUTE_LABEL[route] : "another team";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * THE ROUTING TABLE. Mirrors `private.staff_escalation_route`; the test reads
 * the SQL and fails if a row differs.
 */
export const ROUTING: Record<EscalationCategory, EscalationRoute> = {
  identity_fraud: "trust_safety",
  money: "finance",
  safety: "trust_safety",
  listing: "listing_approval",
  technical: "technical",
  policy_decision: "coo",
  staff_access: "super_admin",
  member_complaint: "support_lead",
  other: "coo",
};

/**
 * Where a category goes next when nobody holds its team, before the COO.
 * Mirrors `private.staff_escalation_route_fallback`.
 */
export const ROUTE_FALLBACK: Partial<Record<EscalationCategory, EscalationRoute>> = {
  identity_fraud: "compliance",
};

/** The places a person can choose when they send an escalation somewhere else. */
export const ROUTE_CHOICES: readonly EscalationRoute[] = [
  "trust_safety",
  "finance",
  "listing_approval",
  "kyc_review",
  "moderation",
  "support",
  "support_lead",
  "agreements",
  "compliance",
  "operations",
  "technical",
  "coo",
  "super_admin",
];

/** 0 the routed team, 1 the COO, 2 the super admin. */
export type EscalationLevel = 0 | 1 | 2;

export function levelOf(route: EscalationRoute): EscalationLevel {
  return route === "super_admin" ? 2 : route === "coo" ? 1 : 0;
}

export type RoutePlan = {
  /** Where it will land. */
  route: EscalationRoute;
  /** Where the category, or the person's own choice, pointed first. */
  intended: EscalationRoute;
  /** True when the first choice has nobody on it, so it went further up. */
  fallback: boolean;
};

/**
 * WHERE AN ESCALATION WILL LAND. The team for the category (or the person's
 * own choice), unless nobody holds it: then the category's fallback, then the
 * COO, then the super admin, so nothing is ever routed to an empty team.
 * `staffed` is the list the database returns of routes that have somebody on
 * them other than the raiser; null means it could not be read, and the plan
 * is then the table's own answer (the database still applies the fallback).
 * Mirrors `private.staff_escalation_resolve_route`.
 */
export function planRoute(
  category: EscalationCategory,
  chosen: EscalationRoute | null,
  staffed: readonly string[] | null,
): RoutePlan {
  const intended = chosen ?? ROUTING[category];
  if (staffed === null) return { route: intended, intended, fallback: false };
  const has = (route: EscalationRoute) => route === "super_admin" || staffed.includes(route);
  const fallback = chosen === null ? ROUTE_FALLBACK[category] : undefined;
  const route: EscalationRoute = has(intended)
    ? intended
    : fallback && has(fallback)
      ? fallback
      : has("coo")
        ? "coo"
        : "super_admin";
  return { route, intended, fallback: route !== intended };
}

/** Who an escalation is with at a level, in words. */
export function withWhom(routedTo: string, level: number): string {
  if (level >= 2) return ROUTE_LABEL.super_admin;
  if (level === 1) return ROUTE_LABEL.coo;
  return isEscalationRoute(routedTo) ? ROUTE_LABEL[routedTo] : "another team";
}

/* ---------------------------------------------------------------- statuses */

export const ESCALATION_STATUSES = ["open", "acknowledged", "in_progress", "waiting_on_raiser", "resolved", "declined"] as const;
export type EscalationStatus = (typeof ESCALATION_STATUSES)[number];

export function isEscalationStatus(value: unknown): value is EscalationStatus {
  return typeof value === "string" && (ESCALATION_STATUSES as readonly string[]).includes(value);
}

export const STATUS_LABEL: Record<EscalationStatus, string> = {
  open: "Not seen yet",
  acknowledged: "Seen",
  in_progress: "Being worked on",
  waiting_on_raiser: "Waiting for an answer",
  resolved: "Resolved",
  declined: "Declined",
};

export function isClosed(status: EscalationStatus): boolean {
  return status === "resolved" || status === "declined";
}

/** How long after it is closed an escalation can be reopened. */
export const REOPEN_DAYS = 14;

/* ------------------------------------------------------------------ events */

export const ESCALATION_EVENT_KINDS = [
  "raised",
  "acknowledged",
  "assigned",
  "comment",
  "rerouted",
  "bumped",
  "asked_raiser",
  "raiser_replied",
  "resolved",
  "declined",
  "reopened",
] as const;
export type EscalationEventKind = (typeof ESCALATION_EVENT_KINDS)[number];

/* ----------------------------------------------------------------- actions */

export const ESCALATION_ACTIONS = [
  "acknowledge",
  "assign",
  "comment",
  "reroute",
  "ask_raiser",
  "raiser_reply",
  "resolve",
  "decline",
  "reopen",
] as const;
export type EscalationAction = (typeof ESCALATION_ACTIONS)[number];

/** Who is looking at a record, as `staff_escalation_get` answers it. */
export type EscalationViewer = {
  /** They raised it. */
  isRaiser: boolean;
  /** They may work it: the routed team, whoever holds it, the COO, the super admin. */
  isHandler: boolean;
  /** The COO or the super admin. */
  isLead: boolean;
  /** It is theirs right now. */
  isAssignee: boolean;
};

export type ActSubject = {
  status: EscalationStatus;
  /** Whether a person still holds the raiser's seat (their account may have closed). */
  hasRaiser: boolean;
  /** When it was resolved or declined, for the reopen window. */
  resolvedAt: string | null;
};

/**
 * MAY THIS PERSON TAKE THIS ACTION NOW? The screen draws only the actions this
 * allows; the database applies the same rules again (`staff_escalation_act`),
 * so a button that is hidden cannot be reached by hand either.
 *
 *   Nobody works their own escalation, except a lead with nobody above them.
 *   A closed escalation takes one action: reopen, by the raiser or a lead,
 *   within 14 days.
 */
export function mayAct(action: EscalationAction, viewer: EscalationViewer, subject: ActSubject, nowMs: number): boolean {
  const live = !isClosed(subject.status);
  const own = viewer.isRaiser && !viewer.isLead;
  const works = viewer.isHandler && !own;
  switch (action) {
    case "acknowledge":
      return works && subject.status === "open";
    case "assign":
      return works && live && !viewer.isAssignee;
    case "comment":
      return live && (viewer.isHandler || viewer.isRaiser);
    case "reroute":
      return works && live;
    case "ask_raiser":
      return works && live && subject.hasRaiser && subject.status !== "waiting_on_raiser";
    case "raiser_reply":
      return viewer.isRaiser && subject.status === "waiting_on_raiser";
    case "resolve":
    case "decline":
      return works && live;
    case "reopen": {
      if (live || !(viewer.isRaiser || viewer.isLead)) return false;
      const closedAt = subject.resolvedAt ? Date.parse(subject.resolvedAt) : Number.NaN;
      return !Number.isNaN(closedAt) && nowMs - closedAt <= REOPEN_DAYS * 86_400_000;
    }
  }
}

/** Every action the viewer may take now, in the order the screen offers them. */
export function actionsFor(viewer: EscalationViewer, subject: ActSubject, nowMs: number): EscalationAction[] {
  return ESCALATION_ACTIONS.filter((action) => mayAct(action, viewer, subject, nowMs));
}

/* ------------------------------------------------------------- text rules */

/** What the person reads when their text carries a number that should be a link. */
export const PERSONAL_NUMBER_REFUSAL = "Link the record instead of pasting an ID or account number.";

/*
 * A run of ten digits or more is an account number (ten), a NIN, a BVN or a
 * phone number (eleven) or a card with no spaces. Four groups of four, or the
 * four-six-five shape, is a card as it is printed. Mirrors
 * `private.staff_escalation_text_ok`.
 */
const LONG_DIGIT_RUN = /[0-9]{10,}/;
const CARD_IN_FOURS = /[0-9]{4}[ -][0-9]{4}[ -][0-9]{4}[ -][0-9]{1,7}/;
const CARD_FOUR_SIX_FIVE = /[0-9]{4}[ -][0-9]{6}[ -][0-9]{5}/;

/** Does this text carry an ID number, a bank account number or a card number? */
export function carriesPersonalNumber(text: string | null | undefined): boolean {
  if (!text) return false;
  return LONG_DIGIT_RUN.test(text) || CARD_IN_FOURS.test(text) || CARD_FOUR_SIX_FIVE.test(text);
}

/* ------------------------------------------------------------- the record */

/** The longest text each field takes. The database holds the same limits. */
export const LIMITS = {
  title: { min: 3, max: 120 },
  whatHappened: { min: 10, max: 4000 },
  whatIsNeeded: { min: 5, max: 2000 },
  note: { min: 2, max: 2000 },
  question: { min: 5, max: 2000 },
  reason: { min: 10, max: 1000 },
  closing: { min: 10, max: 4000 },
  reopen: { min: 5, max: 1000 },
  recordLabel: { max: 120 },
} as const;

/**
 * The attached record: an address inside the console and nowhere else. The
 * database has the same check. Anything else (another site, a path that
 * climbs out, a member page) is dropped, never sent.
 */
export function safeRecordUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (url.length === 0 || url.length > 500) return null;
  if (!/^\/admin\/[^\s\\]*$/.test(url)) return null;
  if (url.includes("//") || url.includes("..")) return null;
  return url;
}

/** The desk an escalation was raised from: the admin path, without its query. */
export function sourceDeskOf(pathname: string | null | undefined): string {
  const path = (pathname ?? "").split(/[?#]/)[0] ?? "";
  return /^\/admin(\/[A-Za-z0-9_/-]*)?$/.test(path) && path.length <= 200 ? path.replace(/\/+$/, "") || "/admin" : "/admin";
}

/** The first folder under /admin, which is the desk. "/admin/kyc/abc" is "/admin/kyc". */
export function deskRoot(sourceDesk: string): string {
  const parts = sourceDesk.split("/").filter(Boolean);
  return parts.length >= 2 ? `/${parts[0]}/${parts[1]}` : "/admin";
}

/** One row of a list, as the screens read it. */
export type EscalationRow = {
  id: string;
  reference: string;
  title: string;
  category: EscalationCategory;
  severity: EscalationSeverity;
  status: EscalationStatus;
  routedTo: string;
  level: EscalationLevel;
  sourceDesk: string;
  raisedByName: string | null;
  raisedByMe: boolean;
  assignedToName: string | null;
  assignedToMe: boolean;
  dueAt: string;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  waitingOnMe: boolean;
};

export type EscalationEvent = {
  id: string;
  kind: EscalationEventKind;
  body: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
  /** Written by the overdue job, not by a person. */
  system: boolean;
  actorName: string | null;
  actorMe: boolean;
};

export type EscalationRecord = EscalationRow & {
  whatHappened: string;
  whatIsNeeded: string;
  recordUrl: string | null;
  recordLabel: string | null;
  resolution: string | null;
  resolvedByName: string | null;
};

export type EscalationView = "for_me" | "mine" | "all";

export function readEscalationView(value: unknown): EscalationView {
  return value === "mine" || value === "all" ? value : "for_me";
}
