import "server-only";

import { protectedRailLive } from "./rail-live";
import { readMyBalance } from "./member-wallet";
import type { Balances, Payment, WithdrawalQuote } from "./vallo";

/**
 * THE READS THE PROTECTED RAIL'S SURFACES NEED, AND THAT DO NOT EXIST YET.
 *
 * Each one is Session 2's, through the D50 adapter that turns a partner's
 * answer into Vallo's vocabulary (`lib/money/vallo.ts`). Until it lands, and
 * until the protected rail is live (`protectedRailLive()`, read on the server),
 * every read answers `absent` without calling anything, and every surface
 * draws its honest absent state. Nothing here ever fabricates a figure: there
 * is no fixture path in this file, and the dev previews pass their fixtures
 * to the components directly, labelled as fixtures.
 *
 * The request each read waits on is named in the C2 report:
 *   readMyBalances          C2 REQUEST 3 (R-3: GET wallet, main and escrow balance)
 *   prepareWithdrawalQuote  C2 REQUEST 4 (R-4/R-5: create the intent, read the fee back)
 *   readMyProtectedPayments C2 REQUEST 9 (R-6 and the section 8 status normalisation)
 */
export type PartnerRead<T> = { state: "absent" } | { state: "failed" } | { state: "ok"; data: T };

const ABSENT = { state: "absent" } as const;

/**
 * C2 REQUEST 3 is answered (7 October 2026): the member balance is read from
 * the partner by `readMyBalance` (lib/money/member-wallet.ts), behind its own
 * switch rather than the protected-payments rail, because a balance exists
 * before any protected payment does. Absent unless that read has the
 * partner's figures, live, with their time.
 */
export async function readMyBalances(): Promise<PartnerRead<Balances>> {
  const read = await readMyBalance();
  if (read.state === "error") return { state: "failed" };
  if (read.state !== "ready" || !read.figures || !read.live) return ABSENT;
  const f = read.figures;
  if (!f.available.confirmedAt) return ABSENT;
  return {
    state: "ok",
    data: { availableMinor: f.available.minor, protectedMinor: f.protected.minor, currency: f.currency, heldBy: "our licensed payments partner", asOf: f.available.confirmedAt },
  };
}

export async function prepareWithdrawalQuote(input: { amountMinor: number; accountId: string }): Promise<PartnerRead<WithdrawalQuote>> {
  void input;
  if (!(await protectedRailLive())) return ABSENT;
  return ABSENT;
}

export async function readMyProtectedPayments(): Promise<PartnerRead<Payment[]>> {
  if (!(await protectedRailLive())) return ABSENT;
  return ABSENT;
}
