import type { MovementStatus } from "./funds";

/**
 * THE TWO FUNDS HELPERS THE WALLET SCREENS RUN IN THE BROWSER (performance
 * audit, 8 November 2026). `funds.ts` reads phone numbers of any country, so
 * it imports Google's number rules (libphonenumber, about 40 KB gzipped), and
 * a client screen importing anything from it carried those rules in its first
 * load: every wallet page did, for a status check and a slice of four digits.
 * They live here, with no imports, and `funds.ts` re-exports both, so every
 * existing caller is unchanged.
 */

/** Still moving: the screen keeps watching these and never calls them done. */
export function isOpenMovement(status: MovementStatus): boolean {
  return status === "processing" || status === "unknown" || status === "awaiting_payment" || status === "under_review";
}

/** The last four digits of an account number, which is all Vallo keeps. */
export function lastFour(accountNumber: string): string {
  const d = accountNumber.replace(/\D/g, "");
  return d.slice(-4);
}
