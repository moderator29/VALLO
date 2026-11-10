import "server-only";

import { cache } from "react";
import { flagIsOn } from "../../flags/read";
import type { FiatProviderId } from "../provider";

/**
 * THE PER-PROVIDER KILL SWITCH. Read once per request (`react.cache`), so a
 * render and the server action it posts to each read it fresh.
 *
 * Two layers. `PAYMENTS_KILL_PAYSTACK=1` in the environment stops Paystack
 * with no database at all, which is what an outage needs. Then a feature
 * flag: Paystack is live today, so it FAILS OPEN: only an explicit
 * `payments_paystack_off` flag stops it, and a failed read does not. A
 * database blip must not stop every payment on the platform.
 *
 * The protected rail has its own fail-closed switches
 * (`lib/money/protected-pay-switch.ts`, `providers/escrowpay/switch.ts`).
 *
 * Gate only what STARTS money movement (collect, charge, refund). Never gate
 * verify, webhooks or reconciliation: money already taken must still be
 * recorded.
 */
export const providerEnabled = cache(async (id: FiatProviderId): Promise<boolean> => {
  void id;
  if (process.env.PAYMENTS_KILL_PAYSTACK === "1") return false;
  return !(await flagIsOn("payments_paystack_off"));
});

export class FiatProviderDisabled extends Error {
  constructor(readonly provider: FiatProviderId) {
    super(`${provider} is switched off.`);
    this.name = "FiatProviderDisabled";
  }
}

export async function assertProviderEnabled(id: FiatProviderId): Promise<void> {
  if (!(await providerEnabled(id))) throw new FiatProviderDisabled(id);
}
