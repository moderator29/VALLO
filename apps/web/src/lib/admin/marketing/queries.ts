import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { faults, isNotLive } from "@/lib/features/degrade";
import { readInternalNotIn } from "@/lib/admin/internal-accounts";
import { lagosDayStartIso } from "@/lib/admin/reads/shared";
import { reportReadFault } from "@/lib/observability/read-error";

import {
  isApproval,
  isCampaignStatus,
  isChannel,
  isMetric,
  lastWeekStarts,
  weeklyCounts,
  type Campaign,
  type CampaignResult,
} from "./model";
import { lagosToday } from "@/lib/admin/desk-rules";

export type DeskRead<T> = { state: "ok"; data: T } | { state: "not-open" } | { state: "error" };

type CampaignRow = {
  id: string;
  name: string;
  objective: string | null;
  channel: string;
  audience: string | null;
  starts_on: string | null;
  ends_on: string | null;
  budget_kobo: number | string | null;
  status: string;
  approval: string;
  approval_note: string | null;
  approved_by: string | null;
  approved_at: string | null;
  owner_id: string | null;
  utm_base: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const CAMPAIGN_SELECT =
  "id, name, objective, channel, audience, starts_on, ends_on, budget_kobo, status, approval, approval_note, approved_by, approved_at, owner_id, utm_base, utm_source, utm_medium, utm_campaign, utm_content, utm_term, notes, created_by, created_at, updated_at";

export function campaignFromRow(r: CampaignRow): Campaign {
  return {
    id: r.id,
    name: r.name,
    objective: r.objective ?? "",
    channel: isChannel(r.channel) ? r.channel : "other",
    audience: r.audience ?? "",
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    budgetKobo: r.budget_kobo === null ? null : Number(r.budget_kobo),
    status: isCampaignStatus(r.status) ? r.status : "draft",
    approval: isApproval(r.approval) ? r.approval : "none",
    approvalNote: r.approval_note,
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    ownerId: r.owner_id,
    utmBase: r.utm_base,
    utmSource: r.utm_source,
    utmMedium: r.utm_medium,
    utmCampaign: r.utm_campaign,
    utmContent: r.utm_content,
    utmTerm: r.utm_term,
    notes: r.notes ?? "",
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function readCampaigns(db: SupabaseClient): Promise<DeskRead<Campaign[]>> {
  const { data, error } = await db.from("marketing_campaigns").select(CAMPAIGN_SELECT).order("created_at", { ascending: false }).limit(500);
  if (error) {
    await reportReadFault("read.admin.marketing.campaigns", ...faults(error));
    return isNotLive(error) ? { state: "not-open" } : { state: "error" };
  }
  return { state: "ok", data: ((data ?? []) as unknown as CampaignRow[]).map(campaignFromRow) };
}

type ResultRow = {
  id: string;
  campaign_id: string;
  recorded_on: string;
  metric: string;
  value: number | string;
  note: string | null;
  voided_at: string | null;
  recorded_by: string | null;
  created_at: string;
};

export async function readResults(db: SupabaseClient): Promise<DeskRead<CampaignResult[]>> {
  const { data, error } = await db
    .from("marketing_campaign_results")
    .select("id, campaign_id, recorded_on, metric, value, note, voided_at, recorded_by, created_at")
    .order("recorded_on", { ascending: false })
    .limit(3000);
  if (error) {
    await reportReadFault("read.admin.marketing.results", ...faults(error));
    return isNotLive(error) ? { state: "not-open" } : { state: "error" };
  }
  return {
    state: "ok",
    data: ((data ?? []) as unknown as ResultRow[]).map((r) => ({
      id: r.id,
      campaignId: r.campaign_id,
      recordedOn: r.recorded_on,
      metric: isMetric(r.metric) ? r.metric : "other",
      value: Number(r.value),
      note: r.note ?? "",
      voidedAt: r.voided_at,
      recordedBy: r.recorded_by,
      createdAt: r.created_at,
    })),
  };
}

/* ------------------------------------------------------------- acquisition */

/**
 * ACQUISITION FIGURES FROM REAL ROWS. Each series is read on its own and is
 * `null` when it could not be read: the desk says "not available" for that
 * series and never draws a zero for it. Counts only, in Monday-start Lagos
 * weeks; no name, email or phone leaves this function. Internal and test
 * accounts are left out of the sign-up figure the way the overview leaves them
 * out. The marketing scope reaches these through the service client its door
 * hands out, so the admin-only RPCs behind the Front door desk are not used.
 */
export type Acquisition = {
  weeks: string[];
  signups: number[] | null;
  listingsCreated: number[] | null;
  referrals: number[] | null;
};

export async function readAcquisition(db: SupabaseClient, now: number = Date.now(), weeks = 8): Promise<Acquisition> {
  const starts = lastWeekStarts(weeks, lagosToday(now));
  const fromIso = lagosDayStartIso(starts[0]!);
  let internal: string | null = null;
  try {
    internal = await readInternalNotIn();
  } catch {
    internal = null;
  }

  const timestamps = async (
    read: () => PromiseLike<{ data: Record<string, string | null>[] | null; error: unknown }>,
    column: string,
    kind: `read.${string}`,
  ): Promise<number[] | null> => {
    const { data, error } = await read();
    if (error || !data) {
      if (error && !isNotLive(error)) await reportReadFault(kind, ...faults(error));
      return null;
    }
    return weeklyCounts(data.map((r) => r[column]).filter((v): v is string => typeof v === "string"), starts);
  };

  const [signups, listingsCreated, referrals] = await Promise.all([
    internal === null
      ? Promise.resolve(null)
      : timestamps(
          () => db.from("profiles").select("created_at").not("id", "in", internal as string).gte("created_at", fromIso).order("created_at").limit(20000) as never,
          "created_at",
          "read.admin.marketing.signups",
        ),
    timestamps(
      () => db.from("listings").select("submitted_at").eq("is_demo", false).gte("submitted_at", fromIso).order("submitted_at").limit(20000) as never,
      "submitted_at",
      "read.admin.marketing.listings",
    ),
    timestamps(
      () => db.from("referrals").select("attributed_at").gte("attributed_at", fromIso).order("attributed_at").limit(20000) as never,
      "attributed_at",
      "read.admin.marketing.referrals",
    ),
  ]);
  return { weeks: starts, signups, listingsCreated, referrals };
}

/* ------------------------------------------------------ referral performance */

export type ReferralPerformance = {
  weeks: string[];
  /** Invited people per week who signed up with a code. */
  attributed: number[];
  /** How many of all the referrals in the window sit in each bucket now. */
  buckets: { pending: number; earned: number; reversed: number };
  /** Referral campaigns: title, status and dates only. No reward figure, no liability. */
  campaigns: { title: string; status: string; startsAt: string; endsAt: string | null }[] | null;
};

/**
 * REFERRAL AND PROMO PERFORMANCE FROM THE REAL REFERRAL ROWS. Counts only, in
 * Monday-start Lagos weeks. The reward amounts, the Rewards Balance and the
 * member names stay with Finance: the marketing desk sees how many people a
 * code brought in and what became of them, nothing about money.
 */
export async function readReferralPerformance(db: SupabaseClient, now: number = Date.now(), weeks = 8): Promise<ReferralPerformance | null> {
  const starts = lastWeekStarts(weeks, lagosToday(now));
  const fromIso = lagosDayStartIso(starts[0]!);
  const [rows, campaigns] = await Promise.all([
    db.from("referrals").select("status, attributed_at").gte("attributed_at", fromIso).order("attributed_at").limit(20000),
    db.from("referral_campaigns").select("title, status, starts_at, ends_at").order("starts_at", { ascending: false }).limit(10),
  ]);
  if (rows.error || !rows.data) {
    if (rows.error && !isNotLive(rows.error)) await reportReadFault("read.admin.marketing.referral-performance", ...faults(rows.error));
    return null;
  }
  const data = rows.data as { status: string | null; attributed_at: string | null }[];
  const earned = new Set(["approved", "available", "withdrawal_requested", "sent", "paid"]);
  const pending = new Set(["attributed", "qualified", "pending", "under_review"]);
  const buckets = { pending: 0, earned: 0, reversed: 0 };
  for (const r of data) {
    if (earned.has(r.status ?? "")) buckets.earned += 1;
    else if (pending.has(r.status ?? "")) buckets.pending += 1;
    else if (r.status === "rejected" || r.status === "reversed") buckets.reversed += 1;
  }
  return {
    weeks: starts,
    attributed: weeklyCounts(data.map((r) => r.attributed_at).filter((v): v is string => typeof v === "string"), starts),
    buckets,
    campaigns: campaigns.error
      ? null
      : ((campaigns.data ?? []) as { title: string; status: string; starts_at: string; ends_at: string | null }[]).map((c) => ({ title: c.title, status: c.status, startsAt: c.starts_at, endsAt: c.ends_at })),
  };
}
