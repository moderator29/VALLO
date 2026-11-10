import { notLive, sentences } from "./common";

export type MoneyContextInput = {
  /** Reconciliation job runs in the window and whether the last was clean, when read. */
  reconciliationRead: boolean;
  /** Move-in charges opened, when read. */
  tenancyCharges: number | null;
  /** The retired Guarantee reserve, in minor units, when read. */
  guaranteeReserveMinor: number | null;
  /** Guarantee claims made before it retired and still open, when read. */
  openClaims: number | null;
};

export function moneyContext(input: MoneyContextInput | null): string {
  if (!input) return notLive("Money");
  return sentences([
    "Vallo never holds customer money: card payments settle at the processor straight to the lister and Vallo",
    input.openClaims !== null ? `${input.openClaims} Guarantee ${input.openClaims === 1 ? "claim" : "claims"} made before it retired still open` : null,
    input.guaranteeReserveMinor !== null ? `The retired Guarantee record shows a balance of N${(input.guaranteeReserveMinor / 100).toLocaleString("en-NG")}` : null,
    input.tenancyCharges !== null ? `${input.tenancyCharges} move-in charges opened` : null,
    input.reconciliationRead ? "The reconciliation panel is live on this page" : null,
  ]);
}
