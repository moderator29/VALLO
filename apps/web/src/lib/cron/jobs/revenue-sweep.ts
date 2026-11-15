import "server-only";

import type { JobVerdict } from "../../bookings/lifecycle";
import type { AdminClient } from "../rpc";
import { recordAlert } from "../../alerts";
import type { Db } from "../../money/member-wallet";
import { protectedRailDeps } from "../../money/protected-rail";
import { runRevenueSweep, SWEEP_DESTINATION_VAR, SWEEP_FLAG, type SweepOutcome } from "../../money/revenue-sweep-run";

/**
 * VALLO'S OWN EARNINGS, MOVED TO VALLO'S BANK, ONCE A DAY.
 *
 * Vallo's share of a protected payment is credited to Vallo's own wallet at
 * the payment partner and sits there. This job moves it. It is the only job
 * that sends Vallo's own money anywhere, so it is deliberately dull: one
 * payout at a time, never while an earlier one is unaccounted for, nothing at
 * all until the founder switches it on and names the destination.
 *
 * None of it is a member's money. A lister is paid straight to their own bank
 * when a payment is released, so the wallet this job empties never holds a
 * member's funds.
 *
 * A run that does nothing is the ordinary state and reads as a clean run with
 * its reason. Two of those reasons are not ordinary (a balance that could not
 * be read, and one far larger than Vallo's share could be) and they raise an
 * alert from the runner itself as well as asking for attention here.
 */
export function revenueSweepVerdict(outcome: SweepOutcome): JobVerdict {
  const moved = outcome.kind === "sent" ? outcome.amountMinor : 0;
  const counts = { swept_minor: moved, sent: outcome.kind === "sent" ? 1 : 0 };
  if (outcome.kind === "failed") {
    return {
      outcome: "attention",
      counts,
      detail: { reason: "failed", why: outcome.why, amount_minor: outcome.amountMinor },
      alert: { kind: "cron.revenue_sweep_failed", severity: "warning", detail: { why: outcome.why, amount_minor: outcome.amountMinor } },
    };
  }
  if (outcome.kind === "unknown") {
    return {
      outcome: "attention",
      counts,
      detail: { reason: "unknown", why: outcome.why, amount_minor: outcome.amountMinor },
      alert: { kind: "cron.revenue_sweep_unknown", severity: "critical", detail: { why: outcome.why, amount_minor: outcome.amountMinor } },
    };
  }
  if (outcome.kind === "held" && (outcome.hold === "balance_unreadable" || outcome.hold === "too_large")) {
    return {
      outcome: "attention",
      counts,
      detail: { reason: outcome.hold },
      alert: { kind: "cron.revenue_sweep_held", severity: "warning", detail: { hold: outcome.hold } },
    };
  }
  const reason =
    outcome.kind === "held" ? outcome.hold : outcome.kind === "sent" ? "sent" : outcome.kind === "still_sending" ? "still_sending" : outcome.kind;
  return { outcome: "ok", counts, detail: reason === "sent" ? { payout_id: outcome.kind === "sent" ? outcome.payoutId : null } : { reason }, alert: null };
}

/** Whether the founder's sweep switch is on. Missing, off or unreadable all mean off. */
async function sweepSwitchOn(admin: AdminClient): Promise<boolean> {
  try {
    const { data, error } = await (admin as unknown as {
      from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> } } };
    })
      .from("feature_flags")
      .select("key, enabled")
      .eq("key", SWEEP_FLAG)
      .maybeSingle();
    if (error || !data) return false;
    return (data as { enabled?: boolean }).enabled === true;
  } catch {
    return false;
  }
}

export async function revenueSweep(admin: AdminClient): Promise<JobVerdict> {
  const alert = async (kind: string, detail: Record<string, unknown>) => {
    await recordAlert({ kind, severity: "critical", detail });
  };
  const rail = protectedRailDeps(admin as unknown as Db, alert);
  const outcome = await runRevenueSweep({
    ...rail,
    destination: process.env[SWEEP_DESTINATION_VAR] ?? null,
    sweepOn: () => sweepSwitchOn(admin),
  });
  return revenueSweepVerdict(outcome);
}
