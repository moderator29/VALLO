import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { ARRANGEMENT_STATUSES, type ArrangementStatus } from "@/lib/money/arrangement-states";

/**
 * THE ARRANGEMENT OPERATIONS DESK'S READ (BUILD 7.11). Read-only: it selects
 * and never writes, calls no function and offers no money action.
 *
 * The door is `requireAdmin("finance")` (an admin, or staff holding the
 * finance scope on a verified console session). `provider_arrangements` is
 * closed to everyone but the two parties under RLS, so once the door has
 * answered the rows are read on the service client, as the chargeback desk
 * reads its held arrangements. The lifecycle columns are taken with
 * `select("*")` and read only when present, so the desk works whether or not
 * a pending column exists.
 */

export type ArrangementOpsRow = {
  id: string;
  reference: string;
  provider: string;
  status: ArrangementStatus | string;
  statusSource: string | null;
  statusObservedAt: string | null;
  providerState: string | null;
  providerStatus: string | null;
  providerReference: string | null;
  amountMinor: number;
  category: string | null;
  environment: string | null;
  lastWebhookAt: string | null;
  lastReconcileAt: string | null;
  lastReconcileResult: string | null;
  reviewReason: string | null;
  releasePausedAt: string | null;
  createdAt: string | null;
};

export type ArrangementOpsRead =
  | { state: "ok"; rows: ArrangementOpsRow[]; total: number; review: number }
  | { state: "forbidden" }
  | { state: "unavailable" };

export type ArrangementFilter = "all" | "review";

export function readArrangementFilter(value: unknown): ArrangementFilter {
  return value === "review" ? "review" : "all";
}

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

export function toOpsRow(raw: Record<string, unknown>): ArrangementOpsRow | null {
  const id = str(raw.id);
  const reference = str(raw.reference);
  if (!id || !reference) return null;
  const status = str(raw.status) ?? "unknown";
  return {
    id,
    reference,
    provider: str(raw.provider) ?? "unknown",
    status: (ARRANGEMENT_STATUSES as readonly string[]).includes(status) ? (status as ArrangementStatus) : status,
    statusSource: str(raw.status_source),
    statusObservedAt: str(raw.status_observed_at),
    providerState: str(raw.provider_state),
    providerStatus: str(raw.provider_status),
    providerReference: str(raw.provider_reference) ?? str(raw.provider_arrangement_id),
    amountMinor: Number(raw.amount_minor ?? 0) || 0,
    category: str(raw.category),
    environment: str(raw.environment),
    lastWebhookAt: str(raw.last_webhook_at),
    lastReconcileAt: str(raw.last_reconcile_at),
    lastReconcileResult: str(raw.last_reconcile_result),
    reviewReason: str(raw.review_reason),
    releasePausedAt: str(raw.release_paused_at),
    createdAt: str(raw.created_at),
  };
}

export async function readArrangementOps(filter: ArrangementFilter, limit = 100): Promise<ArrangementOpsRead> {
  const access = await requireAdmin("finance");
  if (access.state !== "admin") return { state: "forbidden" };
  let service: SupabaseClient;
  try {
    service = createAdminClient() as unknown as SupabaseClient;
  } catch {
    return { state: "unavailable" };
  }
  try {
    let query = service.from("provider_arrangements").select("*").order("created_at", { ascending: false }).limit(limit);
    if (filter === "review") query = query.eq("status", "requires_review");
    const [rows, total, review] = await Promise.all([
      query,
      service.from("provider_arrangements").select("id", { count: "exact", head: true }),
      service.from("provider_arrangements").select("id", { count: "exact", head: true }).eq("status", "requires_review"),
    ]);
    if (rows.error || !Array.isArray(rows.data)) return { state: "unavailable" };
    return {
      state: "ok",
      rows: (rows.data as Record<string, unknown>[]).map(toOpsRow).filter((r): r is ArrangementOpsRow => r !== null),
      total: total.count ?? rows.data.length,
      /* Before the review state exists the filter simply finds nothing. */
      review: review.error ? 0 : (review.count ?? 0),
    };
  } catch {
    return { state: "unavailable" };
  }
}
