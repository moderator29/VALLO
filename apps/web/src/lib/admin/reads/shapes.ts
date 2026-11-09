/**
 * THE SHAPES THE CONSOLE'S READS RETURN AND ITS PANELS ARE DRAWN AGAINST.
 *
 * Types only. The reads that fill them are beside this file
 * (`overview.ts`, `operations.ts`, `analytics.ts`). A shape whose source does
 * not exist in the database yet is still declared, and its panel is handed
 * null and says so.
 *
 * Money is integer kobo throughout and is drawn only through `formatMoney`.
 * Days are Lagos calendar days, `YYYY-MM-DD`; months are `YYYY-MM`.
 */

/** `getConsolePulse()`: the overview's strip and four cards. */
export type ConsolePulse = {
  /** Published, non-example listings now, and the same count as it stood seven days ago. */
  listingsLive: number;
  listingsLiveWeekAgo: number;
  /** Every account on the platform, the two QA accounts left out (founder, 23 September); null where not read. */
  peopleTotal?: number | null;
  /** Profiles created today and yesterday (Lagos days), the QA accounts left out. */
  signupsToday: number;
  signupsYesterday: number;
  /** Money collected (successful charges plus completed wallet deposits), kobo. */
  collectedTodayMinor: number;
  collectedYesterdayMinor: number;
  collectedWeekMinor: number;
  collectedPrevWeekMinor: number;
  /** Listings submitted for review in the last seven days, and the seven before. */
  newSupplyWeek: number;
  newSupplyPrevWeek: number;
  /** Fourteen Lagos days, oldest first, one entry per day, zeros included. */
  daily: { day: string; signups: number; collectedMinor: number; submitted: number; liveAtClose: number }[];
};

/** `getCollectedSeries(range)`: "Naira transacted over time". */
export type CollectedRange = "30d" | "90d" | "12m";
export type CollectedSeries = {
  range: CollectedRange;
  /** One bucket per day (30d), week (90d) or month (12m), oldest first, zeros included. */
  buckets: { start: string; amountMinor: number; count: number }[];
};

/** `getSupplyByType()`: published non-example listings by kind. */
export type SupplyKind = "rent" | "buy" | "land" | "hotels" | "shortlets" | "restaurants";
export type SupplyByType = { rows: { kind: SupplyKind; count: number }[]; total: number };

/** `getNewListingsByRole(months)`: listings created per month by who listed them. */
export type ListingsByRole = {
  months: { month: string; owner: number; agent: number; firm: number }[];
};

/** `skipped`: the job's feature flag was off, so it fired and did nothing (C13). */
export type JobOutcome = "ok" | "attention" | "failed" | "skipped";
/** `getJobHealth()`: every scheduled job, both schedulers. */
export type JobHealthRow = {
  name: string;
  scheduler: "vercel" | "pg_cron";
  /** The cron expression as scheduled. */
  cron: string;
  /** The same in words, e.g. "Hourly at :05". */
  schedule: string;
  lastRunAt: string | null;
  lastDurationMs: number | null;
  lastOutcome: JobOutcome | null;
  /** True when the job has been silent past its allowance. */
  stale: boolean;
  active: boolean;
};
export type JobHealth = { jobs: JobHealthRow[]; checkedAt: string };

/** `getNotificationActivity(days)`: every notification the platform sends. */
export type NotificationActivity = {
  windowDays: number;
  byKind: { kind: string; sent: number; read: number; lastSentAt: string | null }[];
  perDay: { day: string; sent: number }[];
  total: number;
};

/** `getDemand(range)`: searches recorded, which needs a search event log first. */
export type DemandSeries = {
  buckets: { start: string; searches: number; listings: number }[];
  topAreas: { area: string; searches: number }[];
  searchesVsResults: { start: string; searches: number; withResults: number }[];
  totals: { searches: number; searchesPrev: number };
};

/** `getListingViews(range)`: listing detail views, which needs a view log first. */
export type ListingViews = { views: number; viewsPrev: number };

/** `getThinAreas(limit)`: areas with the fewest published listings. */
export type ThinAreas = { rows: { area: string; city: string | null; count: number }[] };

/** `getBookingOutcomes(range)`: confirmed and completed bookings. */
export type BookingOutcomes = { successful: number; successfulPrev: number };

/** `getRefusalReasons(range)`: structured reasons for declines. */
export type RefusalReasons = { rows: { reason: string; count: number }[]; total: number };

/** `getAlertTrend()`: open alerts now and a week ago, for the delta. */
export type AlertTrend = { openNow: number; openWeekAgo: number; daily: { day: string; opened: number }[] };

/** `getInspectionActivity()`: every inspection state, exact, and the newest requests. */
export type InspectionState = "REQUESTED" | "CONFIRMED" | "PROPOSED" | "DECLINED" | "COMPLETED" | "WITHDRAWN" | "NO_SHOW";
export type InspectionActivity = {
  byState: Record<InspectionState, number>;
  total: number;
  recent: { id: string; state: InspectionState; listingTitle: string | null; requestedAt: string; slotAt: string | null; outcome: string | null }[];
  /** No-shows: the disputes waiting on staff, and the people reported more than once. Null when unreadable. */
  noShows: NoShowActivity | null;
};

/** The last 90 days of `inspection_no_shows`, as staff read them. */
export type NoShowActivity = {
  disputes: {
    inspectionId: string;
    listingTitle: string | null;
    absentRole: "requester" | "lister";
    reportedAt: string;
    disputedAt: string;
    disputeNote: string | null;
  }[];
  /** Two or more no-shows that were not overturned, by the person said to have stayed away. */
  repeats: { userId: string; name: string | null; count: number; lastAt: string }[];
};

/** Request A12: account deletions, which only the account holder may read today. */
export type AccountDeletions = { scheduled: number; purging: number; recent: { status: string; requestedAt: string; purgeAfter: string | null }[] };

/** Request A13: business transfers, which only their two parties may read today. */
export type BusinessTransfers = { pending: number; recent: { status: string; offeredAt: string; expiresAt: string | null }[] };

/**
 * `getPriceCheckDemand(range)`: the platform's first demand log. A price
 * check is a person asking what a place in an area should cost; each stage
 * of one check is a row in `price_check_events` (read under
 * `price_check_events_admin_read`).
 */
export type PriceCheckDemand = {
  /** Checks submitted per bucket, and how many of them were answered. */
  buckets: { start: string; checks: number; answered: number }[];
  checks: number;
  checksPrev: number;
  answered: number;
  refused: number;
  /** Local governments by checks submitted, most first. */
  topAreas: { area: string; state: string | null; checks: number }[];
  /** Refusal codes by count, most first. */
  refusals: { code: string; count: number }[];
};

/** The push queue's own states (`push_queue_state`). */
export const PUSH_QUEUE_STATES = ["pending", "held", "sending", "failed", "dead", "done"] as const;
export type PushQueueState = (typeof PUSH_QUEUE_STATES)[number];
/** How a settled push ended (`push_queue_outcome`). */
export const PUSH_OUTCOMES = ["delivered", "suppressed_preference", "suppressed_no_device", "suppressed_expired", "collapsed", "gave_up"] as const;
export type PushOutcome = (typeof PUSH_OUTCOMES)[number];
/** One device attempt (`push_delivery_state`). */
export const PUSH_DELIVERY_STATES = ["sending", "sent", "failed", "gone"] as const;
export type PushDeliveryState = (typeof PUSH_DELIVERY_STATES)[number];

export type PushDeliveryRow = {
  id: string;
  platform: string;
  state: PushDeliveryState;
  providerStatus: number | null;
  /** The provider's error, cut to 160 characters; never a token or a device reference. */
  error: string | null;
  attemptedAt: string;
};

/** `getPushActivity(days)`: push notifications, from `push_queue` and `push_deliveries`. */
export type PushActivity = {
  windowDays: number;
  /** Every queue row by the state it is in now. Exact counts. */
  queue: Record<PushQueueState, number>;
  /** Rows settled in the window, by outcome. Exact counts. */
  outcomes: Record<PushOutcome, number>;
  /** Device attempts in the window, by state. Exact counts. */
  deliveries: Record<PushDeliveryState, number>;
  /** The eight newest device attempts. */
  recent: PushDeliveryRow[];
  /** The eight newest attempts that failed or found the device gone. */
  failures: PushDeliveryRow[];
};

/** A person's published badge tier (`public.person_badge.tier`), never derived here. */
export type PersonTier = "gold" | "platinum";

/**
 * THE QA ACCOUNTS (founder's ruling, 23 September): the two accounts the
 * founder created for live proof, a member and an admin. They are left out of
 * every statistic the console draws (account counts, sign-ups, active
 * people, any per-person aggregate), exactly as the example listings are,
 * and they stay findable in people lists and search, labelled QA, exactly as
 * the examples stay browsable and labelled. One list, here; nothing else in
 * the console names them.
 */
export const QA_ACCOUNT_IDS = [
  "957b3bd2-cce3-425d-bba9-5cd876ca3d62", // the QA member
  "03f3dd52-ea28-4852-9abe-e5b0a67c2a43", // the QA admin
] as const;

/** Is this person one of the QA accounts? For labelling a row "QA" in a list. */
export function isQaAccount(id: string | null | undefined): boolean {
  return Boolean(id) && (QA_ACCOUNT_IDS as readonly string[]).includes(id as string);
}

/** The PostgREST value for `.not(column, "in", QA_NOT_IN)`: every statistic's filter. */
export const QA_NOT_IN = `(${QA_ACCOUNT_IDS.join(",")})`;

/** The pure half: drop QA accounts from rows keyed by a person. Tested. */
export function withoutQa<T>(rows: readonly T[], personOf: (row: T) => string | null | undefined): T[] {
  return rows.filter((row) => !isQaAccount(personOf(row)));
}
