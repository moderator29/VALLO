import { addDays, daysBetween, isHttpUrl, isIsoDate, lagosToday, mondayOfIso, trimmed, trimmedOrNull } from "@/lib/admin/desk-rules";

/**
 * THE CONTENT DESK'S SHAPES (founder, 10 November 2026). Guides,
 * announcements, articles, brand notes and campaign copy move through one
 * approval step before anything is published. The desk holds text and links
 * only; images and video belong to the social media library. Pure and
 * client-safe.
 */

export const KINDS = ["guide", "announcement", "article", "brand_asset", "campaign_copy", "other"] as const;
export type Kind = (typeof KINDS)[number];
export const KIND_LABEL: Record<Kind, string> = {
  guide: "Guide",
  announcement: "Announcement",
  article: "Article",
  brand_asset: "Brand note or link",
  campaign_copy: "Campaign copy",
  other: "Other",
};

export const STATUSES = ["draft", "in_review", "approved", "published", "retired"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  published: "Published",
  retired: "Retired",
};

export const BODY_MAX = 20_000;

export function isKind(v: unknown): v is Kind {
  return typeof v === "string" && (KINDS as readonly string[]).includes(v);
}
export function isStatus(v: unknown): v is Status {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

export type ContentItem = {
  id: string;
  kind: Kind;
  title: string;
  summary: string;
  body: string;
  status: Status;
  plannedFor: string | null;
  ownerId: string | null;
  approverId: string | null;
  approvedAt: string | null;
  reviewNote: string | null;
  linkUrl: string | null;
  publishedUrl: string | null;
  publishedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Where an item may go next. `draft` from `in_review` is the send-back, from `retired` the restore. */
const MOVES: Record<Status, readonly Status[]> = {
  draft: ["in_review", "retired"],
  in_review: ["approved", "draft"],
  approved: ["published", "draft"],
  published: ["retired"],
  retired: ["draft"],
};

export function canMove(from: Status, to: Status): boolean {
  return MOVES[from].includes(to);
}

/** Only a draft is edited in place; anything further along goes back to draft first. */
export function isEditable(status: Status): boolean {
  return status === "draft";
}

/** A published link is required for these kinds; a brand note is a link or a note and can go without. */
export function needsPublishedUrl(kind: Kind): boolean {
  return kind !== "brand_asset" && kind !== "other";
}

export type ItemInput = { kind: string; title: string; summary: string; body: string; plannedFor: string; linkUrl: string };
export type ParsedItem = { value: Record<string, string | null> } | { error: string; fieldErrors: Record<string, string> };

export function parseItem(input: ItemInput): ParsedItem {
  const fieldErrors: Record<string, string> = {};
  const title = trimmed(input.title, 200);
  if (!title) fieldErrors.title = "Give the item a title.";
  if (!isKind(input.kind)) fieldErrors.kind = "Choose a kind.";
  const plannedFor = trimmedOrNull(input.plannedFor, 10);
  if (plannedFor && !isIsoDate(plannedFor)) fieldErrors.plannedFor = "Choose a real date.";
  if ((input.body ?? "").length > BODY_MAX) fieldErrors.body = "That is too long. Split it into two items.";
  const linkUrl = trimmedOrNull(input.linkUrl, 2000);
  if (linkUrl && !isHttpUrl(linkUrl)) fieldErrors.linkUrl = "Use a full web address starting with https://.";
  if (Object.keys(fieldErrors).length > 0) return { error: "Check the highlighted fields and try again.", fieldErrors };
  return {
    value: {
      kind: input.kind,
      title,
      summary: trimmed(input.summary, 1000),
      body: (input.body ?? "").slice(0, BODY_MAX),
      planned_for: plannedFor,
      link_url: linkUrl,
    },
  };
}

/** Planned date has passed and the item has not gone out. */
export function isOverdue(item: Pick<ContentItem, "plannedFor" | "status">, today: string = lagosToday()): boolean {
  if (!item.plannedFor) return false;
  if (item.status === "published" || item.status === "retired") return false;
  return item.plannedFor < today;
}

/** In review for more than a week without a decision. */
export function isStuckInReview(item: Pick<ContentItem, "status" | "updatedAt">, now: number = Date.now()): boolean {
  return item.status === "in_review" && now - Date.parse(item.updatedAt) > 7 * 86_400_000;
}

export type ContentHealth = {
  byStatus: Record<Status, number>;
  byKind: Record<Kind, number>;
  overdue: number;
  stuckInReview: number;
  sentBack: number;
  unscheduled: number;
  publishedThisMonth: number;
  dueThisWeek: number;
};

export function contentHealth(items: readonly ContentItem[], now: number = Date.now()): ContentHealth {
  const today = lagosToday(now);
  const month = today.slice(0, 7);
  const weekStart = mondayOfIso(today);
  const weekEnd = addDays(weekStart, 6);
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  const byKind = Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<Kind, number>;
  for (const i of items) {
    byStatus[i.status] += 1;
    if (i.status !== "retired") byKind[i.kind] += 1;
  }
  return {
    byStatus,
    byKind,
    overdue: items.filter((i) => isOverdue(i, today)).length,
    stuckInReview: items.filter((i) => isStuckInReview(i, now)).length,
    sentBack: items.filter((i) => i.status === "draft" && i.reviewNote).length,
    unscheduled: items.filter((i) => i.plannedFor === null && i.status !== "published" && i.status !== "retired").length,
    publishedThisMonth: items.filter((i) => i.status === "published" && (i.publishedAt ?? "").slice(0, 7) === month).length,
    dueThisWeek: items.filter((i) => i.plannedFor !== null && i.plannedFor >= weekStart && i.plannedFor <= weekEnd && i.status !== "published" && i.status !== "retired").length,
  };
}

export type CalendarWeek = { start: string; label: string; items: ContentItem[] };

/** A month as its Monday-start weeks, each with the items planned in it (not retired), oldest date first. `month` is YYYY-MM. */
export function calendarWeeks(items: readonly ContentItem[], month: string): CalendarWeek[] {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  const first = `${month}-01`;
  if (!isIsoDate(first)) return [];
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const last = `${month}-${String(lastDay).padStart(2, "0")}`;
  const weeks: CalendarWeek[] = [];
  for (let start = mondayOfIso(first); start <= last; start = addDays(start, 7)) {
    const end = addDays(start, 6);
    weeks.push({
      start,
      label: `${start} to ${end}`,
      items: items
        .filter((i) => i.plannedFor !== null && i.plannedFor >= start && i.plannedFor <= end && i.status !== "retired")
        .sort((a, b) => (a.plannedFor! < b.plannedFor! ? -1 : a.plannedFor! > b.plannedFor! ? 1 : 0)),
    });
  }
  return weeks;
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const index = y * 12 + (m - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function daysLate(item: Pick<ContentItem, "plannedFor">, today: string = lagosToday()): number {
  return item.plannedFor ? Math.max(0, daysBetween(item.plannedFor, today)) : 0;
}
