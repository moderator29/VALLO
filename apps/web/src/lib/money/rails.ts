import type { MoneyRail } from "./copy";

/**
 * WHICH RAIL A MEMBER CAN ACTUALLY USE NOW.
 *
 * The DIRECT rail (the processor splits each charge in the same transaction;
 * nobody holds anything) is always live. The PROTECTED rail (a licensed
 * partner holds the payment until the payer confirms) is live only when it
 * can genuinely work, which is a fact the SERVER reads at request time, never
 * a constant: the partner's key is configured for this deployment, the outage
 * stop is not set, and the founder's protected-pay switch is on
 * (`protectedRailLive()` in `rail-live.ts`, which asks `escrowRailLive()`).
 *
 * This file stays pure so client components can import the type: the answer
 * is passed in by the server page that read it.
 *
 * While the protected rail is not live: no Protected figure and no escrow
 * option is drawn, and every live surface speaks the direct rail's sentences.
 * The dev previews draw the protected surfaces with fixture data, labelled as
 * fixtures.
 */

/** The rail a live payment opens on when nothing else is chosen. */
export const LIVE_RAIL: MoneyRail = "direct";

/**
 * Whether a surface for this rail may be reached. `protectedLive` is the
 * server's answer from `protectedRailLive()`.
 */
export function railIsLive(rail: MoneyRail, protectedLive: boolean): boolean {
  return rail === "direct" ? true : protectedLive;
}
