import "server-only";

import { escrowRailLive } from "../payments/providers";

/**
 * THE SERVER'S ANSWER TO "CAN ESCROW WORK RIGHT NOW?" (replaces the constant
 * PROTECTED_RAIL_LIVE, founder instruction of 13 October 2026).
 *
 * True only when all of these hold, read at request time:
 *  - the protected-pay provider's key is configured for this deployment
 *    (`escrowPayConfig`, production credentials in production only);
 *  - the environment stop (`PAYMENTS_KILL_PROTECTED_PAY`) is not `1`, no database needed;
 *  - the protected-pay switch is on (`protectedPaySwitchOn`, fail closed: a
 *    failed read is off).
 * Any error is false: escrow is then simply not offered, and a payer who may
 * pay by card is offered card.
 */
export async function protectedRailLive(): Promise<boolean> {
  try {
    return await escrowRailLive();
  } catch {
    return false;
  }
}
