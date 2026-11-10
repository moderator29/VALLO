import "server-only";

import { cache } from "react";
import { flagIsOn } from "../../../flags/read";

/**
 * THE PROTECTED PAYMENT PROVIDER'S SWITCH. Two layers, as for Payluk
 * (`../kill-switch.ts`): `PAYMENTS_KILL_ESCROWPAY=1` in the environment stops
 * it with no database at all, and otherwise it runs only while the feature
 * flag `payments_escrowpay_on` is explicitly on. It FAILS CLOSED: a missing
 * flag or a failed read means off. That flag is the founder's, nobody else's.
 *
 * It gates only what STARTS money movement. Verify, webhooks and
 * reconciliation are never gated, so money already taken is still recorded.
 */
export const escrowPayEnabled = cache(async (): Promise<boolean> => {
  if (process.env.PAYMENTS_KILL_ESCROWPAY === "1") return false;
  return flagIsOn("payments_escrowpay_on");
});
