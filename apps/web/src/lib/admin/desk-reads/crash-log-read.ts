import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/guard";
import { reportReadError } from "@/lib/observability/read-error";
import type { CrashSource } from "@/lib/observability/crash-fingerprint";

/**
 * THE CRASH LOG, READ FOR THE ADMIN DESK (/admin/crashes; founder ruling of
 * 7 November 2026). Operations scope, through the service role, because
 * `crash_reports` has RLS on and no member policy at all.
 *
 * "missing" is its own answer, not "unavailable": until the pending SQL
 * (`grade1_crash_log.sql`) is applied the table is not there, and the desk
 * says so plainly instead of claiming the database is down.
 */
export type CrashStatus = "open" | "resolved" | "ignored";

export type CrashRow = {
  id: string;
  source: CrashSource;
  kind: string;
  type: string;
  message: string;
  stackTop: string | null;
  area: string | null;
  release: string | null;
  ref: string | null;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
  status: CrashStatus;
};

export type CrashLogRead =
  | { state: "forbidden" }
  | { state: "unavailable" }
  | { state: "missing" }
  | { state: "ok"; rows: CrashRow[]; open: number; last24h: number; bySource: Record<CrashSource, number> };

const STATUSES: readonly CrashStatus[] = ["open", "resolved", "ignored"];
const SOURCES: readonly CrashSource[] = ["web", "ios", "android", "server"];

export function crashStatusFrom(value: unknown): CrashStatus {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value) ? (value as CrashStatus) : "open";
}

export function crashSourceFilter(value: unknown): CrashSource | null {
  return typeof value === "string" && (SOURCES as readonly string[]).includes(value) ? (value as CrashSource) : null;
}

function isMissingTable(fault: { code?: string; message?: string } | null): boolean {
  if (!fault) return false;
  return fault.code === "42P01" || fault.code === "PGRST205" || /crash_reports/.test(fault.message ?? "");
}

export async function readCrashLog(filter: { status: CrashStatus; source: CrashSource | null }): Promise<CrashLogRead> {
  const access = await requireAdmin("operations");
  if (access.state !== "admin") return { state: "forbidden" };
  try {
    const admin = createAdminClient();
    const table = () => admin.from("crash_reports" as never);
    let list = table()
      .select("id, source, kind, error_type, message, stack_top, area, release, last_ref, occurrences, first_seen_at, last_seen_at, status")
      .eq("status", filter.status);
    if (filter.source) list = list.eq("source", filter.source);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [rows, open, recent] = await Promise.all([
      list.order("last_seen_at", { ascending: false }).limit(100),
      table().select("source").eq("status", "open").limit(1000),
      table().select("id", { count: "exact", head: true }).gte("last_seen_at", since),
    ]);
    const missing = isMissingTable(rows.error as never);
    if (!missing) await reportReadError("read.admin.crash_log", rows.error, open.error);
    const fault = rows.error ?? open.error;
    if (missing) return { state: "missing" };
    if (fault) return { state: "unavailable" };
    const bySource: Record<CrashSource, number> = { web: 0, ios: 0, android: 0, server: 0 };
    for (const row of (open.data ?? []) as { source?: string }[]) {
      if (row.source && row.source in bySource) bySource[row.source as CrashSource] += 1;
    }
    return {
      state: "ok",
      rows: ((rows.data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        source: (SOURCES as readonly string[]).includes(String(row.source)) ? (row.source as CrashSource) : "web",
        kind: String(row.kind ?? ""),
        type: String(row.error_type ?? "Error"),
        message: String(row.message ?? ""),
        stackTop: typeof row.stack_top === "string" ? row.stack_top : null,
        area: typeof row.area === "string" ? row.area : null,
        release: typeof row.release === "string" ? row.release : null,
        ref: typeof row.last_ref === "string" ? row.last_ref : null,
        occurrences: Number(row.occurrences ?? 1),
        firstSeenAt: String(row.first_seen_at),
        lastSeenAt: String(row.last_seen_at),
        status: crashStatusFrom(row.status),
      })),
      open: (open.data ?? []).length,
      last24h: recent.count ?? 0,
      bySource,
    };
  } catch {
    return { state: "unavailable" };
  }
}
