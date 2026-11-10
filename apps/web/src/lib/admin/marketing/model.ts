import { addDays, daysBetween, isHttpUrl, isIsoDate, koboFromNairaInput, lagosToday, mondayOfIso, trimmed, trimmedOrNull } from "@/lib/admin/desk-rules";

/**
 * THE MARKETING DESK'S SHAPES (founder, 10 November 2026). Planning and
 * reporting only: no ad platform, no email tool and no credential is
 * connected. The Marketing Manager plans a campaign, builds its tracked link,
 * sends it for approval by the COO or an admin, and logs the numbers each
 * campaign produced from the real dashboards. Pure and client-safe.
 */

export const CHANNELS = ["social", "email", "sms", "referral", "partnership", "events", "paid", "other"] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABEL: Record<Channel, string> = {
  social: "Social media",
  email: "Email",
  sms: "SMS",
  referral: "Referral",
  partnership: "Partnership",
  events: "Events",
  paid: "Paid advertising",
  other: "Other",
};

export const CAMPAIGN_STATUSES = ["draft", "planned", "live", "paused", "ended", "cancelled"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Draft",
  planned: "Planned",
  live: "Live",
  paused: "Paused",
  ended: "Ended",
  cancelled: "Cancelled",
};

export const APPROVALS = ["none", "submitted", "approved", "sent_back"] as const;
export type Approval = (typeof APPROVALS)[number];
export const APPROVAL_LABEL: Record<Approval, string> = {
  none: "Not sent for approval",
  submitted: "Waiting for approval",
  approved: "Approved",
  sent_back: "Sent back",
};

export const METRICS = ["spend_kobo", "impressions", "clicks", "signups", "listings_created", "referrals", "other"] as const;
export type Metric = (typeof METRICS)[number];
export const METRIC_LABEL: Record<Metric, string> = {
  spend_kobo: "Spend (naira)",
  impressions: "Impressions",
  clicks: "Clicks",
  signups: "Sign-ups",
  listings_created: "Listings created",
  referrals: "Referrals",
  other: "Other",
};

export function isChannel(v: unknown): v is Channel {
  return typeof v === "string" && (CHANNELS as readonly string[]).includes(v);
}
export function isCampaignStatus(v: unknown): v is CampaignStatus {
  return typeof v === "string" && (CAMPAIGN_STATUSES as readonly string[]).includes(v);
}
export function isApproval(v: unknown): v is Approval {
  return typeof v === "string" && (APPROVALS as readonly string[]).includes(v);
}
export function isMetric(v: unknown): v is Metric {
  return typeof v === "string" && (METRICS as readonly string[]).includes(v);
}

export type Campaign = {
  id: string;
  name: string;
  objective: string;
  channel: Channel;
  audience: string;
  startsOn: string | null;
  endsOn: string | null;
  /** Naira in kobo; null when no budget is set. Shown only to the marketing desk and admins. */
  budgetKobo: number | null;
  status: CampaignStatus;
  approval: Approval;
  approvalNote: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  ownerId: string | null;
  utmBase: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  notes: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignResult = {
  id: string;
  campaignId: string;
  recordedOn: string;
  metric: Metric;
  value: number;
  note: string;
  voidedAt: string | null;
  recordedBy: string | null;
  createdAt: string;
};

/**
 * The allowed status moves. `draft` becomes `planned` only through approval,
 * and `live` only from an approved campaign (checked by the action, which
 * also reads `approval`). `cancelled` can be undone back to `draft`.
 */
const MOVES: Record<CampaignStatus, readonly CampaignStatus[]> = {
  draft: ["cancelled"],
  planned: ["live", "cancelled"],
  live: ["paused", "ended"],
  paused: ["live", "ended", "cancelled"],
  ended: [],
  cancelled: [],
};

export function canMoveStatus(from: CampaignStatus, to: CampaignStatus): boolean {
  return MOVES[from].includes(to);
}

export function nextStatuses(from: CampaignStatus): readonly CampaignStatus[] {
  return MOVES[from];
}

/** Editable until it ends or is cancelled. */
export function isEditable(status: CampaignStatus): boolean {
  return status !== "ended" && status !== "cancelled";
}

/* ----------------------------------------------------------------- UTM links */

export type UtmInput = { base: string; source: string; medium: string; campaign: string; content?: string; term?: string };
export type UtmResult = { ok: true; url: string; tags: Record<string, string> } | { ok: false; error: string; field: keyof UtmInput };

/** A UTM value: lower case, letters, digits, dot, dash, underscore; runs of anything else become one dash. */
export function utmValue(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/**
 * Builds the tracked link. The base must be an http or https address with no
 * username or password in it; a query string already on it is kept, and any
 * utm_ tag already on it is replaced rather than doubled. Source, medium and
 * campaign are required, as every analytics tool expects.
 */
export function buildUtmLink(input: UtmInput): UtmResult {
  const base = input.base.trim();
  if (!base) return { ok: false, error: "Enter the page the link points to.", field: "base" };
  if (!isHttpUrl(base)) return { ok: false, error: "The page must be a full web address starting with https://.", field: "base" };
  const tags: Record<string, string> = {};
  const required: [keyof UtmInput, string, string][] = [
    ["source", "utm_source", "Enter where the link will be placed (for example instagram)."],
    ["medium", "utm_medium", "Enter the kind of channel (for example social or email)."],
    ["campaign", "utm_campaign", "Enter the campaign name."],
  ];
  for (const [field, tag, message] of required) {
    const value = utmValue(String(input[field] ?? ""));
    if (!value) return { ok: false, error: message, field };
    tags[tag] = value;
  }
  for (const [field, tag] of [["content", "utm_content"], ["term", "utm_term"]] as const) {
    const value = utmValue(String(input[field] ?? ""));
    if (value) tags[tag] = value;
  }
  const url = new URL(base);
  for (const key of [...url.searchParams.keys()]) if (key.startsWith("utm_")) url.searchParams.delete(key);
  for (const [key, value] of Object.entries(tags)) url.searchParams.set(key, value);
  return { ok: true, url: url.toString(), tags };
}

/* ------------------------------------------------------------------- summary */

export function spendKobo(results: readonly CampaignResult[], campaignId: string): number {
  return results
    .filter((r) => r.campaignId === campaignId && r.metric === "spend_kobo" && !r.voidedAt)
    .reduce((total, r) => total + Math.round(r.value), 0);
}

export function metricTotals(results: readonly CampaignResult[], campaignId: string): Partial<Record<Metric, number>> {
  const out: Partial<Record<Metric, number>> = {};
  for (const r of results) {
    if (r.campaignId !== campaignId || r.voidedAt) continue;
    out[r.metric] = (out[r.metric] ?? 0) + r.value;
  }
  return out;
}

export type BudgetLine = { campaignId: string; budgetKobo: number; spentKobo: number; remainingKobo: number; over: boolean };

/** Budget against logged spend, for campaigns that have a budget. */
export function budgetLines(campaigns: readonly Campaign[], results: readonly CampaignResult[]): BudgetLine[] {
  return campaigns
    .filter((c) => c.budgetKobo !== null && c.status !== "cancelled")
    .map((c) => {
      const spent = spendKobo(results, c.id);
      const budget = c.budgetKobo as number;
      return { campaignId: c.id, budgetKobo: budget, spentKobo: spent, remainingKobo: budget - spent, over: spent > budget };
    });
}

export type MarketingSummary = {
  total: number;
  byStatus: Record<CampaignStatus, number>;
  waitingApproval: number;
  sentBack: number;
  endingWithinSevenDays: number;
  overBudget: number;
  resultsThisWeek: number;
};

export function summarise(campaigns: readonly Campaign[], results: readonly CampaignResult[], now: number = Date.now()): MarketingSummary {
  const today = lagosToday(now);
  const week = mondayOfIso(today);
  const byStatus = Object.fromEntries(CAMPAIGN_STATUSES.map((s) => [s, 0])) as Record<CampaignStatus, number>;
  for (const c of campaigns) byStatus[c.status] += 1;
  return {
    total: campaigns.length,
    byStatus,
    waitingApproval: campaigns.filter((c) => c.approval === "submitted" && c.status !== "cancelled").length,
    sentBack: campaigns.filter((c) => c.approval === "sent_back" && c.status === "draft").length,
    endingWithinSevenDays: campaigns.filter((c) => c.status === "live" && c.endsOn !== null && daysBetween(today, c.endsOn) >= 0 && daysBetween(today, c.endsOn) <= 7).length,
    overBudget: budgetLines(campaigns, results).filter((l) => l.over).length,
    resultsThisWeek: results.filter((r) => !r.voidedAt && r.recordedOn >= week).length,
  };
}

/** Which board column a campaign sits in: planned (not started), live (running or paused) or ended. */
export function boardColumn(c: Pick<Campaign, "status">): "planned" | "live" | "ended" | "other" {
  if (c.status === "draft" || c.status === "planned") return "planned";
  if (c.status === "live" || c.status === "paused") return "live";
  if (c.status === "ended") return "ended";
  return "other";
}

/* ---------------------------------------------------------- weekly figures */

/** Counts of dated events per Monday-start week, oldest first. `weekStarts` are YYYY-MM-DD Mondays. */
export function weeklyCounts(dates: readonly string[], weekStarts: readonly string[]): number[] {
  const counts = weekStarts.map(() => 0);
  for (const raw of dates) {
    /* A timestamp is counted on its Lagos day; a plain date is that date. */
    const day = raw.length > 10 ? lagosToday(Date.parse(raw)) : raw;
    if (!isIsoDate(day)) continue;
    const monday = mondayOfIso(day);
    const slot = weekStarts.indexOf(monday);
    if (slot >= 0) counts[slot] = counts[slot]! + 1;
  }
  return counts;
}

/** The last `n` Monday-start weeks ending with the week of `today`, oldest first. */
export function lastWeekStarts(n: number, today: string): string[] {
  const thisWeek = mondayOfIso(today);
  return Array.from({ length: n }, (_, i) => addDays(thisWeek, -7 * (n - 1 - i)));
}

/* ------------------------------------------------------------------- form */

export type CampaignInput = {
  name: string;
  objective: string;
  channel: string;
  audience: string;
  startsOn: string;
  endsOn: string;
  /** Naira as typed, e.g. "250,000". Blank for no budget. */
  budget: string;
  notes: string;
  utmBase: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
};

export type ParsedCampaign = { value: Record<string, string | number | null> } | { error: string; fieldErrors: Record<string, string> };

/** Validates a campaign form before any write; returns the row to store or the field problems. */
export function parseCampaign(input: CampaignInput): ParsedCampaign {
  const fieldErrors: Record<string, string> = {};
  const name = trimmed(input.name, 140);
  if (!name) fieldErrors.name = "Give the campaign a name.";
  if (!isChannel(input.channel)) fieldErrors.channel = "Choose a channel.";
  const startsOn = trimmedOrNull(input.startsOn, 10);
  const endsOn = trimmedOrNull(input.endsOn, 10);
  if (startsOn && !isIsoDate(startsOn)) fieldErrors.startsOn = "Choose a real date.";
  if (endsOn && !isIsoDate(endsOn)) fieldErrors.endsOn = "Choose a real date.";
  if (startsOn && endsOn && !fieldErrors.startsOn && !fieldErrors.endsOn && endsOn < startsOn) fieldErrors.endsOn = "The end cannot be before the start.";
  let budget: number | null = null;
  if (trimmed(input.budget, 40)) {
    budget = koboFromNairaInput(input.budget);
    if (budget === null) fieldErrors.budget = "Enter an amount in naira, such as 250000.";
  }
  const utmBase = trimmedOrNull(input.utmBase, 300);
  if (utmBase && !isHttpUrl(utmBase)) fieldErrors.utmBase = "Use a full web address starting with https://.";
  if (Object.keys(fieldErrors).length > 0) return { error: "Check the highlighted fields and try again.", fieldErrors };
  const tag = (v: string) => utmValue(v) || null;
  return {
    value: {
      name,
      objective: trimmed(input.objective, 1000),
      channel: input.channel,
      audience: trimmed(input.audience, 500),
      starts_on: startsOn,
      ends_on: endsOn,
      budget_kobo: budget,
      notes: trimmed(input.notes, 4000),
      utm_base: utmBase,
      utm_source: tag(input.utmSource),
      utm_medium: tag(input.utmMedium),
      utm_campaign: tag(input.utmCampaign),
      utm_content: tag(input.utmContent),
      utm_term: tag(input.utmTerm),
    },
  };
}

