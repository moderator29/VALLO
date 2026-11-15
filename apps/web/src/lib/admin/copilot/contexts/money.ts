import { countOf } from "@vallo/i18n/core";
import { countWord, notLive, sentences } from "./common";

export type MoneyContextInput = {
  /** Reconciliation job runs in the window and whether the last was clean, when read. */
  reconciliationRead: boolean;
  /** Move-in charges opened, when read. */
  tenancyCharges: number | null;
  /** The retired Guarantee reserve, in minor units, when read. */
  guaranteeReserveMinor: number | null;
  /** Guarantee claims made before it retired and still open, when read. */
  openClaims: number | null;
  /** Chargebacks open on the desk, when read. The Money row badges them too. */
  openChargebacks?: number | null;
  /** Refunds the desk has recorded in the window, when read. */
  refundsInWindow?: number | null;
};

export function moneyContext(input: MoneyContextInput | null): string {
  if (!input) return notLive("Money");
  return sentences([
    "Vallo never holds customer money: card payments settle at the processor straight to the lister and Vallo",
    input.openClaims !== null ? countOf(input.openClaims, "guaranteeClaimsOpen") : null,
    input.guaranteeReserveMinor !== null ? `The retired Guarantee record shows a balance of N${(input.guaranteeReserveMinor / 100).toLocaleString("en-NG")}` : null,
    input.tenancyCharges !== null ? `${input.tenancyCharges} move-in charges opened` : null,
    typeof input.openChargebacks === "number" ? `${countWord(input.openChargebacks, "chargeback")} open` : null,
    typeof input.refundsInWindow === "number" ? `${input.refundsInWindow} refunds recorded in the window on screen` : null,
    input.reconciliationRead ? "The reconciliation panel is live on this page" : null,
  ]);
}
