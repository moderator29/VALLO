/**
 * THE SOCIAL MEDIA DESK'S SHAPES (founder, 10 November 2026).
 *
 * This is a planning and reporting tool, never a publishing integration.
 * Nothing in this folder or anywhere else in the desk calls a social platform
 * API, asks for an OAuth token, or stores a platform credential. The Social
 * Media Manager plans a post here, sends it for approval, posts it by hand on
 * the real platform in a separate browser tab, then comes back and records
 * that it went out. This file holds only the shapes both the queries and the
 * actions share, so the two never drift.
 */

export const PLATFORMS = ["instagram", "facebook", "tiktok", "x", "linkedin", "youtube", "other"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const CATEGORIES = [
  "property",
  "stays",
  "restaurants",
  "roommates",
  "circle",
  "product_announcement",
  "brand_campaign",
  "educational",
  "customer_story",
  "partnership",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** A feed post, a short-form video/reel and a story are each a different line
 * on the Social Media Manager's own monthly targets, so the desk can report
 * each separately rather than lumping every post into one count. */
export const FORMATS = ["feed_post", "reel", "story", "other"] as const;
export type Format = (typeof FORMATS)[number];

/**
 * The real weekly planning sheet (9 November to 11 December 2026) is a grid:
 * weekdays Monday to Friday down the side, four fixed posting windows across
 * the top. `slot` is that column; it is optional because a post can still be
 * planned with no slot chosen yet.
 */
export const SLOTS = ["post_1", "post_2", "post_3", "post_4"] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_LABEL: Record<Slot, string> = {
  post_1: "Post 1 · 8am to 11am",
  post_2: "Post 2 · 11am to 2pm",
  post_3: "Post 3 · 2pm to 6pm",
  post_4: "Post 4 · 6pm to 9pm",
};

export const STATUSES = ["draft", "awaiting_approval", "approved", "posted", "cancelled"] as const;
export type Status = (typeof STATUSES)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  x: "X",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  other: "Other",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  property: "Property",
  stays: "Stays",
  restaurants: "Restaurants",
  roommates: "Roommates",
  circle: "Circle",
  product_announcement: "Product announcement",
  brand_campaign: "Brand campaign",
  educational: "Educational",
  customer_story: "Customer story",
  partnership: "Partnership",
  other: "Other",
};

export const FORMAT_LABEL: Record<Format, string> = {
  feed_post: "Feed post",
  reel: "Short-form video / reel",
  story: "Story / update",
  other: "Other",
};

export const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  posted: "Posted",
  cancelled: "Cancelled",
};

export type SocialPost = {
  id: string;
  platform: Platform;
  category: Category;
  format: Format;
  slot: Slot | null;
  campaign: string | null;
  caption: string;
  plannedAt: string; // ISO date, no time
  status: Status;
  mediaUrls: string[];
  approvedBy: string | null;
  approvedAt: string | null;
  postedAt: string | null;
  liveUrl: string | null;
  rejectionReason: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export function isPlatform(v: unknown): v is Platform {
  return typeof v === "string" && (PLATFORMS as readonly string[]).includes(v);
}
export function isCategory(v: unknown): v is Category {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}
export function isFormat(v: unknown): v is Format {
  return typeof v === "string" && (FORMATS as readonly string[]).includes(v);
}
export function isSlot(v: unknown): v is Slot {
  return typeof v === "string" && (SLOTS as readonly string[]).includes(v);
}
export function isStatus(v: unknown): v is Status {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

/** A planned date is overdue once it has passed and the post never went out. */
export function isOverdue(post: Pick<SocialPost, "plannedAt" | "status">, today: Date = new Date()): boolean {
  if (post.status !== "draft" && post.status !== "awaiting_approval") return false;
  return post.plannedAt < today.toISOString().slice(0, 10);
}

/** Monday of the week that holds `date` (weekday-only planning, no weekends). */
export function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday through Friday of the week holding `date`, as ISO dates. */
export function weekdaysOf(date: Date): string[] {
  const monday = mondayOf(date);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    return toISODate(d);
  });
}

const WEEKDAY_NAME = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function weekdayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  const idx = date.getUTCDay() - 1;
  const name = idx >= 0 && idx < 5 ? WEEKDAY_NAME[idx] : date.toDateString();
  return `${name} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** The weekday grid: five days, each carrying the posts planned on it, slotted. */
export type WeekGrid = { day: string; label: string; slots: Record<Slot, SocialPost[]>; unslotted: SocialPost[] }[];

export function buildWeekGrid(weekdays: string[], posts: readonly SocialPost[]): WeekGrid {
  return weekdays.map((day) => {
    const onDay = posts.filter((p) => p.plannedAt === day);
    const slots: Record<Slot, SocialPost[]> = { post_1: [], post_2: [], post_3: [], post_4: [] };
    const unslotted: SocialPost[] = [];
    for (const p of onDay) {
      if (p.slot) slots[p.slot].push(p);
      else unslotted.push(p);
    }
    return { day, label: weekdayLabel(day), slots, unslotted };
  });
}

export type ReportSummary = {
  thisWeekScheduled: number;
  thisWeekByFormat: Record<Format, number>;
  overdue: number;
  activeCampaigns: number;
  postedThisMonthByPlatform: Record<string, number>;
  postedThisMonthByCategory: Record<string, number>;
  postedThisMonth: number;
};

/** A short, honest line for the copilot's context, built only from rows read. */
export function copilotContext(summary: ReportSummary): string {
  return [
    `${summary.thisWeekScheduled} posts scheduled this week`,
    `${summary.overdue} overdue`,
    `${summary.activeCampaigns} campaign${summary.activeCampaigns === 1 ? "" : "s"} active`,
    `${summary.postedThisMonth} posted this month`,
  ].join(", ");
}

export function buildReportSummary(posts: readonly SocialPost[], today: Date = new Date()): ReportSummary {
  const todayIso = toISODate(today);
  const monthPrefix = todayIso.slice(0, 7);
  const weekdays = new Set(weekdaysOf(today));

  const thisWeekByFormat: Record<Format, number> = { feed_post: 0, reel: 0, story: 0, other: 0 };
  let thisWeekScheduled = 0;
  let overdue = 0;
  const campaigns = new Set<string>();
  const postedThisMonthByPlatform: Record<string, number> = {};
  const postedThisMonthByCategory: Record<string, number> = {};
  let postedThisMonth = 0;

  for (const p of posts) {
    if (weekdays.has(p.plannedAt) && p.status !== "cancelled") {
      thisWeekScheduled += 1;
      thisWeekByFormat[p.format] += 1;
    }
    if (isOverdue(p, today)) overdue += 1;
    if (p.campaign && p.status !== "cancelled" && p.status !== "posted") campaigns.add(p.campaign);
    if (p.status === "posted" && p.postedAt && p.postedAt.slice(0, 7) === monthPrefix) {
      postedThisMonth += 1;
      postedThisMonthByPlatform[p.platform] = (postedThisMonthByPlatform[p.platform] ?? 0) + 1;
      postedThisMonthByCategory[p.category] = (postedThisMonthByCategory[p.category] ?? 0) + 1;
    }
  }

  return {
    thisWeekScheduled,
    thisWeekByFormat,
    overdue,
    activeCampaigns: campaigns.size,
    postedThisMonthByPlatform,
    postedThisMonthByCategory,
    postedThisMonth,
  };
}
