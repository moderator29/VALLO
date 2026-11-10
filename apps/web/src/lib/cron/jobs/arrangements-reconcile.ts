import "server-only";

import type { JobVerdict } from "../../bookings/lifecycle";
import type { AdminClient } from "../rpc";
import { recordAlert } from "../../alerts";
import type { Db } from "../../money/member-wallet";
import { protectedRailDeps, providerReachable, reconcileProtected, type ProtectedReconcileSummary as ReconcileSummary } from "../../money/protected-rail";

/**
 * The escrow webhook's safety net. Every arrangement still waiting on the
 * payment partner's word (preparing, unknown, payment processing, release
 * asked, disputed) is read back, at most three a run (the provider's rate allowance is shared across everything), and the partner's answer is recorded
 * through the same door the webhook uses (`provider_arrangement_observe`).
 * Recording only: never gated by the protected-pay switches.
 * With no key for this deployment there is nothing to ask, and the run says so.
 */
export function arrangementsVerdict(summary: ReconcileSummary, configured: boolean): JobVerdict {
  const counts = { read: summary.read, moved: summary.moved, unchanged: summary.skipped, failed: summary.failed };
  return {
    outcome: summary.failed > 0 ? "attention" : "ok",
    counts,
    detail: configured ? {} : { reason: "no_partner_key" },
    alert: summary.failed > 0 ? { kind: "cron.arrangements_reconcile_failed", severity: "warning", detail: counts } : null,
  };
}

export async function arrangementsReconcile(admin: AdminClient): Promise<JobVerdict> {
  const alert = async (kind: string, detail: Record<string, unknown>) => {
    await recordAlert({ kind, severity: "critical", detail });
  };
  const empty: ReconcileSummary = { read: 0, moved: 0, skipped: 0, failed: 0 };
  /* The protected rail reads back its own rows through its own adapter;
     while the provider is undocumented it reads nothing. */
  const deps = protectedRailDeps(admin as unknown as Db, alert);
  const configured = providerReachable(deps);
  const summary = configured ? await reconcileProtected(deps, 3) : empty;
  return arrangementsVerdict(summary, configured);
}
