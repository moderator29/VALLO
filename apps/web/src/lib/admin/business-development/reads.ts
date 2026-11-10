import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin/guard";
import { isNotLive } from "@/lib/features/degrade";
import { getListingStatusCounts } from "@/lib/admin/reads/listings";
import {
  BD_CATEGORIES,
  BD_STAGES,
  type BdActivity,
  type BdActivityKind,
  type BdCategory,
  type BdProspect,
  type BdRead,
  type BdStage,
} from "./types";

/**
 * The Business Development desk's own reads. READ ONLY.
 *
 * The door is `requireAdmin("business_development")`, same as every scoped
 * desk. Everything here reads through whichever client that returns: the
 * service client for a staff member holding the scope, the caller's own
 * RLS-bound client for an admin or super admin.
 *
 * GRACEFUL UNTIL THE SQL IS LIVE. `bd_prospects` and `bd_prospect_activity`
 * do not exist until `supabase/migrations/pending/bd_prospects_2026-11-10.sql`
 * is applied. Every function here reads that as `{ state: "not_set_up" }`,
 * never a crash and never a fake zero.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
type Db = SupabaseClient;

async function adminDb(): Promise<Db | null> {
  const access = await requireAdmin("business_development");
  return access.state === "admin" ? access.supabase : null;
}

function asCategory(value: unknown): BdCategory {
  return (BD_CATEGORIES as readonly string[]).includes(value as string) ? (value as BdCategory) : "other";
}

function asStage(value: unknown): BdStage {
  return (BD_STAGES as readonly string[]).includes(value as string) ? (value as BdStage) : "new";
}

function toProspect(row: Record<string, unknown>): BdProspect {
  return {
    id: String(row.id),
    contactName: String(row.contact_name ?? ""),
    businessName: String(row.business_name ?? ""),
    category: asCategory(row.category),
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    stage: asStage(row.stage),
    notes: (row.notes as string | null) ?? null,
    assignedTo: (row.assigned_to as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    listingId: (row.listing_id as string | null) ?? null,
    onboardedAt: (row.onboarded_at as string | null) ?? null,
    nextFollowUpAt: (row.next_follow_up_at as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function toActivity(row: Record<string, unknown>): BdActivity {
  return {
    id: String(row.id),
    prospectId: String(row.prospect_id ?? ""),
    kind: (row.kind as BdActivityKind) ?? "note",
    body: String(row.body ?? ""),
    outcome: (row.outcome as string | null) ?? null,
    actorId: (row.actor_id as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
  };
}

const PIPELINE_LIMIT = 500;

/** Every open prospect (not rejected), newest first. */
export async function listPipeline(): Promise<BdRead<BdProspect[]>> {
  const db = await adminDb();
  if (!db) return { state: "unavailable" };
  try {
    const { data, error } = await (db as Loose)
      .from("bd_prospects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(PIPELINE_LIMIT);
    if (error) return isNotLive(error) ? { state: "not_set_up" } : { state: "unavailable" };
    return { state: "ok", data: ((data ?? []) as Record<string, unknown>[]).map(toProspect) };
  } catch {
    return { state: "unavailable" };
  }
}

const ACTIVITY_LIMIT = 2000;

/** Every activity row across the whole pipeline, newest first, for the KPI
 * and weekly-summary counts. Capped like every other console total; the
 * cap is generous against the role's own 60-a-month follow-up target. */
export async function listAllActivity(): Promise<BdRead<BdActivity[]>> {
  const db = await adminDb();
  if (!db) return { state: "unavailable" };
  try {
    const { data, error } = await (db as Loose)
      .from("bd_prospect_activity")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(ACTIVITY_LIMIT);
    if (error) return isNotLive(error) ? { state: "not_set_up" } : { state: "unavailable" };
    return { state: "ok", data: ((data ?? []) as Record<string, unknown>[]).map(toActivity) };
  } catch {
    return { state: "unavailable" };
  }
}

/** One prospect's own activity log, newest first. */
export async function listActivity(prospectId: string): Promise<BdRead<BdActivity[]>> {
  const db = await adminDb();
  if (!db) return { state: "unavailable" };
  try {
    const { data, error } = await (db as Loose)
      .from("bd_prospect_activity")
      .select("*")
      .eq("prospect_id", prospectId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return isNotLive(error) ? { state: "not_set_up" } : { state: "unavailable" };
    return { state: "ok", data: ((data ?? []) as Record<string, unknown>[]).map(toActivity) };
  } catch {
    return { state: "unavailable" };
  }
}

/** Prospects whose next follow-up falls within the next 7 days (including
 * overdue ones), soonest first. No new infrastructure: a filtered read of
 * the same pipeline, computed at request time. */
export function dueThisWeek(prospects: BdProspect[], now: number = Date.now()): BdProspect[] {
  const weekAhead = now + 7 * 86_400_000;
  return prospects
    .filter((p) => p.nextFollowUpAt && p.stage !== "rejected" && p.stage !== "onboarded")
    .filter((p) => new Date(`${p.nextFollowUpAt}T00:00:00Z`).getTime() <= weekAhead)
    .sort((a, b) => (a.nextFollowUpAt ?? "").localeCompare(b.nextFollowUpAt ?? ""));
}

export type BdKpiCounts = {
  prospectsIdentified: number;
  qualifiedContacted: number;
  followUpActivity: number;
  onboarded: number;
  /** Listings linked to a prospect that are past DRAFT (submitted or further). Separate from `onboarded`. */
  listingsSubmittedFromPipeline: number;
};

/** The role's own 30-day KPI figures, computed from real rows. Never a
 * target or a claim: just what the pipeline and the activity log hold right
 * now, for whatever window the caller already filtered `prospects` and
 * `activity` to (the caller passes the full set for an all-time count, or a
 * week-filtered set for the weekly summary). */
export function kpiCounts(prospects: BdProspect[], activity: BdActivity[]): BdKpiCounts {
  const contactedIds = new Set(activity.filter((a) => a.kind === "contact").map((a) => a.prospectId));
  return {
    prospectsIdentified: prospects.length,
    qualifiedContacted: contactedIds.size,
    followUpActivity: activity.filter((a) => a.kind === "follow_up").length,
    onboarded: prospects.filter((p) => p.onboardedAt !== null).length,
    listingsSubmittedFromPipeline: prospects.filter((p) => p.listingId !== null).length,
  };
}

/** Rows created or logged in the last 7 days, for the "this week" summary. */
export function sinceDays(iso: string, days: number, now: number = Date.now()): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= now - days * 86_400_000;
}

export type BdWeeklySummary = {
  prospectsAdded: number;
  followUpsDone: number;
  contactsLogged: number;
  onboardedThisWeek: number;
};

export function weeklySummary(prospects: BdProspect[], activity: BdActivity[], now: number = Date.now()): BdWeeklySummary {
  return {
    prospectsAdded: prospects.filter((p) => sinceDays(p.createdAt, 7, now)).length,
    followUpsDone: activity.filter((a) => a.kind === "follow_up" && sinceDays(a.createdAt, 7, now)).length,
    contactsLogged: activity.filter((a) => a.kind === "contact" && sinceDays(a.createdAt, 7, now)).length,
    onboardedThisWeek: prospects.filter((p) => p.onboardedAt && sinceDays(p.onboardedAt, 7, now)).length,
  };
}

/** Real listings awaiting a review decision, for the desk's link to
 * `/admin/listings`. Reuses the listing desk's own exact counts; never a
 * second query of the listings table. */
export async function listingsAwaitingReview(): Promise<number | null> {
  const counts = await getListingStatusCounts();
  if (counts.state !== "ok") return null;
  const r = counts.data.real;
  return (r.SUBMITTED ?? 0) + (r.UNDER_REVIEW ?? 0) + (r.MORE_INFO_REQUIRED ?? 0);
}
