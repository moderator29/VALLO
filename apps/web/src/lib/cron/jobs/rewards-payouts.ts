import "server-only";

import { ALERT_ID_LIMIT, spreadIds, type JobVerdict } from "../../bookings/lifecycle";
import { sweepRewardsPayouts } from "../../payouts/referral-payout";

/**
 * D51/D62. Hourly: the Rewards Balance payout sweep.
 *
 * Three jobs in one pass, each of them the only reader of its database
 * function (see `lib/payouts/referral-payout.ts` for what happened while this
 * route did not exist):
 *
 *   1. `rewards_payouts_to_send`: a payout opened, or released from review by
 *      staff, whose transfer was never initiated. `sendOpenedPayout` claims
 *      each one before it calls Paystack, so a payout is sent once even if
 *      two runs overlap.
 *   2. `rewards_payouts_to_verify`: a payout in flight for ten minutes is read
 *      back from Paystack. Nothing is paid or released here: only the signed
 *      `transfer.*` webhook pays or fails a payout, and a verify that says
 *      failed records `verify_failed` and raises its own high alert.
 *   3. `rewards_payouts_stuck`: anything in flight for more than a day is a
 *      person's problem, and is named in a critical alert rather than printed.
 *
 * The sweep answers `{ sent: 0, checked: 0, stuck: [] }` and this job reads
 * `ok` when there is no service role or no float key, which is the normal
 * state while payouts are switched off: nothing to do is not attention.
 */
export async function rewardsPayouts(): Promise<JobVerdict> {
  const run = await sweepRewardsPayouts();
  const counts = { sent: run.sent, checked: run.checked, stuck: run.stuck.length };
  if (run.stuck.length === 0) {
    return { outcome: "ok", counts, detail: {}, alert: null };
  }
  return {
    outcome: "attention",
    counts,
    detail: { stuck: run.stuck.slice(0, ALERT_ID_LIMIT) },
    alert: {
      kind: "rewards_payout.stuck",
      severity: "critical",
      detail: spreadIds("stuck", run.stuck),
    },
  };
}
