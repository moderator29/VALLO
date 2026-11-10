import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isNotLive } from "@/lib/features/degrade";
import { getListingSubmissions, getRiskAlerts } from "@/lib/admin/queries";
import { getModerationSummary, getHeldEvents } from "@/lib/admin/reads/moderation";
import { getSupportQueue } from "@/lib/admin/support-queue";
import { readAgreementQueue } from "@/lib/admin/reads/agreements";
import { reviewHref } from "@/app/admin/listings/tabs";
import { requireCoo } from "./guard";

/**
 * THE COO DESK'S CROSS-DESK BACKLOG, READ FROM EACH DESK'S OWN FUNCTION.
 *
 * Every count and every row below comes from the same read the desk itself
 * already uses (`lib/admin/reads/listings.ts` and `queries.ts` for
 * listings and alerts, `reads/moderation.ts`, `support-queue.ts`,
 * `reads/agreements.ts`). Nothing here queries a table a second time.
 *
 * ROWS ARE THE REAL OLDEST FEW, NOT A GUESS. Agreements and support already
 * read their waiting bucket oldest-first; listings and alerts read newest
 * first, so this file sorts the page it got back before taking the oldest
 * few. That is the true oldest WHENEVER the underlying read says its page
 * is not full (`full: false` means every waiting row came back, so sorting
 * what you have is sorting everything); `capped` says so on a card when it
 * is not.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

export type BacklogItem = { id: string; title: string; createdAt: string; href: string };
export type BacklogCard =
  | { state: "ok"; count: number; items: BacklogItem[]; capped: boolean }
  | { state: "unavailable" };
const UNAVAILABLE: BacklogCard = { state: "unavailable" };

async function listingsCard(): Promise<BacklogCard> {
  const read = await getListingSubmissions({});
  if (read.state !== "ok") return UNAVAILABLE;
  const waiting = [...read.data.waiting].sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""));
  return {
    state: "ok",
    count: waiting.length,
    capped: read.data.full,
    items: waiting.slice(0, 5).map((l) => ({
      id: l.id,
      title: l.title || "Untitled listing",
      createdAt: l.submittedAt ?? "",
      href: reviewHref(l.id, {}),
    })),
  };
}

async function moderationCard(): Promise<BacklogCard> {
  const [summary, held] = await Promise.all([getModerationSummary(), getHeldEvents()]);
  if (summary.state !== "ok") return UNAVAILABLE;
  const count = summary.data.openReports + summary.data.reviewingReports;
  const items: BacklogItem[] =
    held.state === "ok"
      ? held.data.slice(0, 5).map((h) => ({ id: h.id, title: h.title || "Held event", createdAt: h.createdAt, href: "/admin/queue" }))
      : [];
  return { state: "ok", count, items, capped: false };
}

async function supportCard(): Promise<BacklogCard> {
  const read = await getSupportQueue({});
  if (read.state !== "ok") return UNAVAILABLE;
  const open = read.data.rows
    .filter((r) => r.status === "open" || r.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    state: "ok",
    count: open.length,
    capped: open.length >= 200,
    items: open.slice(0, 5).map((t) => ({
      id: t.id,
      title: t.reference ? `${t.reference}: ${t.preview}` : t.preview,
      createdAt: t.createdAt,
      href: `/admin/support?ticket=${t.id}`,
    })),
  };
}

async function agreementsCard(db: SupabaseClient): Promise<BacklogCard> {
  const read = await readAgreementQueue(db);
  if (read.state !== "ok") return UNAVAILABLE;
  return {
    state: "ok",
    count: read.waiting.length,
    capped: read.waiting.length >= 200,
    items: read.waiting.slice(0, 5).map((a) => ({
      id: a.id,
      title: a.listingTitle || "Untitled",
      createdAt: a.submittedAt ?? "",
      href: "/admin/agreements",
    })),
  };
}

async function operationsAlertsCard(): Promise<BacklogCard> {
  const read = await getRiskAlerts({ status: "open" });
  if (read.state !== "ok") return UNAVAILABLE;
  const rows = [...read.data.rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    state: "ok",
    count: rows.length,
    capped: read.data.full,
    items: rows.slice(0, 5).map((a) => ({ id: a.id, title: a.title, createdAt: a.createdAt, href: "/admin/alerts" })),
  };
}

export type CooBacklog = {
  listings: BacklogCard;
  moderation: BacklogCard;
  support: BacklogCard;
  agreements: BacklogCard;
  operations: BacklogCard;
};

/** Every desk's backlog, read in parallel through each desk's own function. */
export async function readCooBacklog(db: SupabaseClient): Promise<CooBacklog> {
  const [listings, moderation, support, agreements, operations] = await Promise.all([
    listingsCard(),
    moderationCard(),
    supportCard(),
    agreementsCard(db),
    operationsAlertsCard(),
  ]);
  return { listings, moderation, support, agreements, operations };
}

/* --------------------------------------------------------- escalations */

export type CooEscalation = {
  id: string;
  raisedBy: string;
  sourceDesk: string;
  subject: string;
  detail: string;
  status: "open" | "in_progress" | "resolved";
  resolvedBy: string | null;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type CooRead<T> = { state: "ok"; data: T } | { state: "unavailable" } | { state: "not_set_up" };

function toEscalation(row: Record<string, unknown>): CooEscalation {
  return {
    id: String(row.id),
    raisedBy: String(row.raised_by ?? ""),
    sourceDesk: String(row.source_desk ?? "other"),
    subject: String(row.subject ?? ""),
    detail: String(row.detail ?? ""),
    status: (row.status as CooEscalation["status"]) ?? "open",
    resolvedBy: (row.resolved_by as string | null) ?? null,
    resolutionNote: (row.resolution_note as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
    resolvedAt: (row.resolved_at as string | null) ?? null,
  };
}

/** Any admin or super admin, or a full-bundle COO, may read the escalation
 * list through `requireCoo`. A plain scoped team lead reaches it only by
 * holding every COO scope or by role; see the guard's own notes. */
export async function listEscalations(): Promise<CooRead<CooEscalation[]>> {
  const access = await requireCoo();
  if (access.state !== "coo") return { state: "unavailable" };
  try {
    const { data, error } = await (access.supabase as Loose)
      .from("coo_escalations")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) return isNotLive(error) ? { state: "not_set_up" } : { state: "unavailable" };
    return { state: "ok", data: ((data ?? []) as Record<string, unknown>[]).map(toEscalation) };
  } catch {
    return { state: "unavailable" };
  }
}

/* ------------------------------------------------- staff access recommendations */

export type StaffAccessRecommendation = {
  id: string;
  recommendedBy: string;
  aboutName: string;
  recommendedPositionOrScope: string;
  reason: string;
  status: "open" | "actioned" | "declined";
  createdAt: string;
};

function toRecommendation(row: Record<string, unknown>): StaffAccessRecommendation {
  return {
    id: String(row.id),
    recommendedBy: String(row.recommended_by ?? ""),
    aboutName: String(row.about_name ?? ""),
    recommendedPositionOrScope: String(row.recommended_position_or_scope ?? ""),
    reason: String(row.reason ?? ""),
    status: (row.status as StaffAccessRecommendation["status"]) ?? "open",
    createdAt: String(row.created_at ?? ""),
  };
}

export async function listStaffAccessRecommendations(): Promise<CooRead<StaffAccessRecommendation[]>> {
  const access = await requireCoo();
  if (access.state !== "coo") return { state: "unavailable" };
  try {
    const { data, error } = await (access.supabase as Loose)
      .from("staff_access_recommendations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return isNotLive(error) ? { state: "not_set_up" } : { state: "unavailable" };
    return { state: "ok", data: ((data ?? []) as Record<string, unknown>[]).map(toRecommendation) };
  } catch {
    return { state: "unavailable" };
  }
}

/** Whether `coo_escalations` exists yet, read once for the page's gate. */
export async function escalationsInstalled(): Promise<boolean> {
  const read = await listEscalations();
  return read.state !== "not_set_up";
}
