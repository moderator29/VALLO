/**
 * TRUST AND SAFETY, THE MODEL (8 November 2026). Pure types, labels and
 * filters for the case desk. The database holds every rule
 * (`supabase/migrations/pending/roommates_7_trust_safety.sql`): who may see
 * and do what is `private.case_can`, and every read and write is a function
 * that checks it. This file only mirrors the shapes.
 */
import type { BadgeKind, PersonRef } from "@/lib/features/roommates/model";

export const CASE_MODULES = ["roommates", "circle", "feed", "property", "stays", "messages", "account", "other"] as const;
export type CaseModule = (typeof CASE_MODULES)[number];

export const CASE_STATUSES = ["new", "under_review", "awaiting_info", "escalated", "resolved", "closed"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type CaseSeverity = (typeof CASE_SEVERITIES)[number];

export const CASE_CATEGORIES = [
  "scam",
  "off_platform_payment",
  "unsafe",
  "harassment",
  "impersonation",
  "discrimination",
  "misleading",
  "spam",
  "inappropriate",
  "offensive",
  "group_dispute",
  "not_as_described",
  "unavailable",
  "duplicate",
  "other",
] as const;
export type CaseCategory = (typeof CASE_CATEGORIES)[number];

export const CASE_RESOLUTIONS = [
  "no_action",
  "content_removed",
  "content_restored",
  "warning_issued",
  "member_restricted",
  "member_suspended",
  "listing_removed",
  "group_closed",
  "verification_revoked",
  "referred",
  "duplicate",
  "other",
] as const;
export type CaseResolution = (typeof CASE_RESOLUTIONS)[number];

export const RESTRICTION_KINDS = ["warning", "messaging", "posting", "roommates", "suspended"] as const;
export type RestrictionKind = (typeof RESTRICTION_KINDS)[number];

/** Actions on the thing reported; which apply depends on the target type. */
export const CASE_ACTIONS = {
  post: ["hold_content", "remove_content", "restore_content"],
  roommate_listing: ["remove_content", "restore_content", "revoke_verification"],
  roommate_profile: ["hold_profile", "restore_profile", "revoke_verification"],
  roommate_group: ["close_group", "restore_group"],
  circle_community: ["pause_community", "remove_community", "restore_community"],
} as const;
export type CaseAction = (typeof CASE_ACTIONS)[keyof typeof CASE_ACTIONS][number];

export const MODULE_LABEL: Record<CaseModule, string> = {
  roommates: "Roommates",
  circle: "Circle",
  feed: "Feed",
  property: "Property",
  stays: "Stays",
  messages: "Messages",
  account: "Account",
  other: "Other",
};

export const STATUS_LABEL: Record<CaseStatus, string> = {
  new: "New",
  under_review: "Under review",
  awaiting_info: "Awaiting information",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
};

export const SEVERITY_LABEL: Record<CaseSeverity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };

export const CATEGORY_LABEL: Record<CaseCategory, string> = {
  scam: "Scam",
  off_platform_payment: "Payment outside Vallo",
  unsafe: "Safety concern",
  harassment: "Harassment",
  impersonation: "Fake identity",
  discrimination: "Discrimination",
  misleading: "Misleading",
  spam: "Spam or unwanted contact",
  inappropriate: "Inappropriate content",
  offensive: "Offensive",
  group_dispute: "Group dispute",
  not_as_described: "Not as described",
  unavailable: "Not available",
  duplicate: "Duplicate",
  other: "Other",
};

export const RESOLUTION_LABEL: Record<CaseResolution, string> = {
  no_action: "No breach found",
  content_removed: "Content removed",
  content_restored: "Content restored",
  warning_issued: "Warning issued",
  member_restricted: "Member restricted",
  member_suspended: "Member suspended",
  listing_removed: "Post removed",
  group_closed: "Group closed",
  verification_revoked: "Verification revoked",
  referred: "Referred elsewhere",
  duplicate: "Duplicate case",
  other: "Other",
};

export const RESTRICTION_LABEL: Record<RestrictionKind, string> = {
  warning: "Warning",
  messaging: "No new messages",
  posting: "No posting (feed and Circle)",
  roommates: "No Vallo Roommates",
  suspended: "Suspended (all of the above)",
};

export const ACTION_LABEL: Record<CaseAction, string> = {
  hold_content: "Hold for review",
  remove_content: "Remove",
  restore_content: "Restore",
  hold_profile: "Hold profile",
  restore_profile: "Restore profile",
  revoke_verification: "Revoke verification",
  close_group: "Close group",
  restore_group: "Reopen group",
  pause_community: "Pause community",
  remove_community: "Remove community",
  restore_community: "Restore community",
};

/** The answer to "what may I do here", from `admin_case_view`. */
export type CaseCan = {
  note: boolean;
  assign: boolean;
  status: boolean;
  escalate: boolean;
  resolve: boolean;
  restrict: boolean;
  suspend: boolean;
  message: boolean;
  documents: boolean;
};

export type CaseRow = {
  id: string;
  number: number;
  module: CaseModule;
  category: CaseCategory | string;
  severity: CaseSeverity;
  status: CaseStatus;
  targetType: string;
  targetId: string;
  targetLabel: string | null;
  summary: string | null;
  reportCount: number;
  team: string;
  subject: PersonRef | null;
  assignee: PersonRef | null;
  dueAt: string | null;
  overdue: boolean;
  escalatedAt: string | null;
  resolution: CaseResolution | null;
  resolvedAt: string | null;
  lastActivityAt: string;
  createdAt: string;
};

export type CaseEvent = {
  id: string;
  kind: "opened" | "report_added" | "note" | "status" | "assigned" | "escalated" | "action" | "message" | "evidence" | "resolved" | "reopened" | "appeal";
  body: string | null;
  data: Record<string, unknown>;
  createdAt: string;
  actor: PersonRef | null;
};

export type CaseReport = { id: string; category: string | null; reason: string | null; status: string; createdAt: string; reporter: PersonRef | null };

export type CaseRestriction = { id: string; kind: RestrictionKind; reason: string; startsAt: string; endsAt: string | null; liftedAt: string | null; active: boolean };

export type CaseDetail = CaseRow & {
  resolutionNote: string | null;
  escalationReason: string | null;
  /** What the case is about, as the database read it (shape varies by `kind`). */
  context: Record<string, unknown> & { kind: string; href?: string; gone?: boolean };
  reports: CaseReport[];
  events: CaseEvent[];
  evidence: { id: string; path: string; note: string | null; createdAt: string; addedBy: PersonRef | null }[];
  subjectHistory: {
    cases: number;
    upheld: number;
    restrictions: CaseRestriction[];
    memberSince: string | null;
    badges: BadgeKind[];
  } | null;
  can: CaseCan;
};

export type CaseFilters = {
  status: CaseStatus | "open" | null;
  module: CaseModule | null;
  severity: CaseSeverity | null;
  assigned: "any" | "me" | "none";
  overdue: boolean;
  q: string;
  offset: number;
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : null);
const pick = <T extends string>(v: string | null, all: readonly T[]): T | null => (v && (all as readonly string[]).includes(v) ? (v as T) : null);

/** Filters from the address bar, so a desk link and Back land on the same list. */
export function readCaseFilters(p: Params): CaseFilters {
  const status = one(p.status);
  return {
    status: status === "all" ? null : status === "open" || status === null ? "open" : pick(status, CASE_STATUSES),
    module: pick(one(p.module), CASE_MODULES),
    severity: pick(one(p.severity), CASE_SEVERITIES),
    assigned: pick(one(p.assigned), ["any", "me", "none"] as const) ?? "any",
    overdue: one(p.overdue) === "1",
    q: one(p.q)?.slice(0, 80) ?? "",
    offset: Math.max(0, Number(one(p.offset) ?? 0) || 0),
  };
}

export function caseFiltersQuery(f: Partial<CaseFilters>): string {
  const q = new URLSearchParams();
  if (f.status === null) q.set("status", "all");
  else if (f.status && f.status !== "open") q.set("status", f.status);
  if (f.module) q.set("module", f.module);
  if (f.severity) q.set("severity", f.severity);
  if (f.assigned && f.assigned !== "any") q.set("assigned", f.assigned);
  if (f.overdue) q.set("overdue", "1");
  if (f.q) q.set("q", f.q);
  if (f.offset) q.set("offset", String(f.offset));
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** "VC-000123": the number staff say out loud and members quote. */
export function caseNumber(n: number): string {
  return `VC-${String(n).padStart(6, "0")}`;
}

/** Restriction lengths offered on the desk; null is "until lifted". */
export const RESTRICTION_DAYS = [1, 3, 7, 14, 30, 90, null] as const;

/** Does this length need Trust and Safety (mirrors admin_restrict_member)? */
export function restrictionIsHeavy(kind: RestrictionKind, days: number | null): boolean {
  if (kind === "warning") return false;
  return kind === "suspended" || days === null || days > 30;
}
