import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportReadFault } from "@/lib/observability/read-error";
import { aggregate, type Aggregate, type Range, type ReasonRow } from "./model";

export type DeletionReasonsRead =
  | { state: "ok"; rows: ReasonRow[] }
  /** The table is not there yet: the pending SQL file is not applied. */
  | { state: "not-switched-on" }
  | { state: "unavailable" };

/** Rows a read will draw. A year of deletions at launch scale is far below this. */
export const READ_LIMIT = 5000;

const MISSING_TABLE = new Set(["42P01", "PGRST205"]);

/**
 * Every deletion reason, newest first, for the desk and the copilot tool.
 * NEVER selects user_id. The note column is read only when `withNotes` is true
 * (a super admin); everyone else gets counts.
 */
export async function readDeletionReasons(client: SupabaseClient, withNotes: boolean): Promise<DeletionReasonsRead> {
  try {
    const columns = withNotes ? "reason, requested_at, restored_at, note" : "reason, requested_at, restored_at";
    const { data, error } = await client
      .from("account_deletion_reasons")
      .select(columns)
      .order("requested_at", { ascending: false })
      .limit(READ_LIMIT);
    if (error) {
      if (MISSING_TABLE.has(error.code ?? "")) return { state: "not-switched-on" };
      await reportReadFault("read.admin.account_deletions", error);
      return { state: "unavailable" };
    }
    const rows = (Array.isArray(data) ? data : []).map((r: unknown) => {
      const row = r as Record<string, unknown>;
      return {
        reason: String(row.reason ?? "not_given"),
        requestedAt: String(row.requested_at ?? ""),
        restoredAt: typeof row.restored_at === "string" ? row.restored_at : null,
        note: withNotes && typeof row.note === "string" ? row.note : null,
      };
    });
    return { state: "ok", rows };
  } catch (error) {
    await reportReadFault("read.admin.account_deletions", error);
    return { state: "unavailable" };
  }
}

/** The read turned into what the desk draws, with the server clock read here rather than in a render. */
export function toDeskRead(
  result: DeletionReasonsRead,
  range: Range,
  withNotes: boolean,
): { state: "ok"; aggregate: Aggregate } | { state: "not-switched-on" } | { state: "unavailable" } {
  return result.state === "ok" ? { state: "ok", aggregate: aggregate(result.rows, range, Date.now(), withNotes) } : result;
}
