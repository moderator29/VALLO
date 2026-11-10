import "server-only";

import { reportReadFault } from "../observability/read-error";
import { tenureBucket, type TenureBucket } from "./reason-model";
import type { DeletionClient } from "./rpc";

/**
 * The reason a member gave for leaving, kept in `public.account_deletion_reasons`
 * (pending SQL account_deletion_reasons_2026-11-10.sql).
 *
 * BEST EFFORT, ALWAYS. The deletion has already been scheduled when this runs,
 * so a missing table or a failed insert must never turn it into an error. A
 * fault other than "the table is not there yet" is reported; the not-there
 * case is the expected state until the SQL is applied and stays silent.
 */

type Writer = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: { code?: string | null; message?: string | null } | null }>;
    update: (row: Record<string, unknown>) => {
      eq: (column: string, value: string) => {
        is: (column: string, value: null) => PromiseLike<{ error: { code?: string | null; message?: string | null } | null }>;
      };
    };
  };
};

const TABLE = "account_deletion_reasons";
const MISSING = new Set(["42P01", "PGRST205"]);

async function settle(kind: `read.${string}`, run: () => PromiseLike<{ error: { code?: string | null } | null }>): Promise<boolean> {
  try {
    const { error } = await run();
    if (!error) return true;
    if (!MISSING.has(error.code ?? "")) await reportReadFault(kind, error);
    return false;
  } catch (error) {
    await reportReadFault(kind, error);
    return false;
  }
}

export async function recordDeletionReason(
  client: DeletionClient,
  entry: { userId: string; reason: string | undefined; note: string | undefined; accountCreatedAt: string | null | undefined; now?: number },
): Promise<boolean> {
  const note = (entry.note ?? "").trim().slice(0, 500);
  const bucket: TenureBucket | null = tenureBucket(entry.accountCreatedAt, entry.now ?? Date.now());
  return settle("read.account_deletion.record_reason", () =>
    (client as unknown as Writer).from(TABLE).insert({
      user_id: entry.userId,
      reason: entry.reason ?? "not_given",
      note: note.length > 0 ? note : null,
      tenure_bucket: bucket,
    }),
  );
}

/** The account came back inside the window: flag every open reason row for it. */
export async function markReasonRestored(client: DeletionClient, userId: string, now: Date = new Date()): Promise<boolean> {
  return settle("read.account_deletion.mark_restored", () =>
    (client as unknown as Writer).from(TABLE).update({ restored_at: now.toISOString() }).eq("user_id", userId).is("restored_at", null),
  );
}
