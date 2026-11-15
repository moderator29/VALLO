import "server-only";

import type { JobVerdict } from "../../bookings/lifecycle";
import { isNotDeployed } from "../../observability/read-error";
import type { AdminClient } from "../rpc";

/**
 * ESCALATIONS, EVERY TEN MINUTES. An escalation nobody answered inside its
 * response time moves up a level: the team to the COO, the COO to the super
 * admin, with half the window again (never under an hour). At the top it is
 * reminded once a day. A question still with the raiser is the raiser's
 * clock: they are reminded once a day and nothing moves up.
 *
 * All of it is one definer function, `staff_escalation_bump_overdue`
 * (`supabase/migrations/pending/staff_escalations_2026-11-15.sql`), so each
 * move is one transaction with its timeline line, its audit line and the
 * people it tells, and two runs at once skip the rows the other holds. It is
 * executable by the service role only.
 *
 * UNTIL THAT SQL HAS RUN the function does not exist. That is the expected
 * state, so the run is clean and says why, rather than failing every ten
 * minutes on the alerts desk. Any other error is a failed run.
 */
export type OverdueSummary = { bumped: number; reminded: number; nudged: number };

export function escalationsOverdueVerdict(summary: OverdueSummary | null): JobVerdict {
  if (summary === null) {
    return { outcome: "ok", counts: { moved_up: 0, reminded: 0, raiser_reminded: 0 }, detail: { reason: "not_set_up" }, alert: null };
  }
  return {
    outcome: "ok",
    counts: { moved_up: summary.bumped, reminded: summary.reminded, raiser_reminded: summary.nudged },
    detail: {},
    alert: null,
  };
}

type RpcError = { code?: string | null; message?: string | null };
type RpcCaller = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: RpcError | null }>;
};

const count = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

export async function escalationsOverdue(admin: AdminClient): Promise<JobVerdict> {
  const { data, error } = await (admin as unknown as RpcCaller).rpc("staff_escalation_bump_overdue", {});
  if (error) {
    if (isNotDeployed(error)) return escalationsOverdueVerdict(null);
    throw new Error(`staff_escalation_bump_overdue: ${error.message ?? error.code ?? "rpc error"}`);
  }
  const answer = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  /* Anything but "ok" is the function refusing the caller: a failed run, never a quiet zero. */
  if (!answer || answer.status !== "ok") {
    throw new Error(`staff_escalation_bump_overdue: answered ${String(answer?.status ?? "nothing")}`);
  }
  return escalationsOverdueVerdict({ bumped: count(answer.bumped), reminded: count(answer.reminded), nudged: count(answer.nudged) });
}
