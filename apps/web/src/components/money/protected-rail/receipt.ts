import { formatMoney, type Locale } from "@vallo/i18n/core";
import type { ReceiptModel } from "@/components/app/money/receipt-model";
import {
  PROTECTED_RECEIPT_EVENT,
  PROTECTED_RECEIPT_FIGURE,
  PROTECTED_RECEIPT_NOTE,
  PROTECTED_RECEIPT_ROWS,
  PROTECTED_RECEIPT_TITLE,
  PROTECTED_RECEIPT_TOTAL,
  PROTECTED_REVIEW_ROWS,
  PROTECTED_ROW_FEE_LISTER_PAYS,
  PROTECTED_STAGE_LABEL,
  PROTECTED_WHERE_VALLO,
  protectedAgreementVersion,
} from "@/lib/money/copy";
import { protectedQuote } from "@/lib/money/protected-fees";
import type { ProtectedStage } from "@/lib/money/protected-journey";
import { PROTECTED_FUNDS_WORDING_FULL } from "@/lib/money/protected-wording";
import { lagosTime } from "./kit";
import type { ProtectedDeal } from "./types";

/** One dated event in a protected payment's history, in the order it happened. */
export type ProtectedHistoryEvent = { key: keyof typeof PROTECTED_RECEIPT_EVENT; at: string };

/**
 * The release or refund history (BUILD 7.4), from the stamps Vallo recorded
 * from the provider's own word. A step with no stamp is not a row: a record
 * says what happened, never what is expected.
 */
export function protectedHistory(deal: Pick<ProtectedDeal, "stamps" | "receipt">): ProtectedHistoryEvent[] {
  const events: (ProtectedHistoryEvent | null)[] = [
    deal.stamps.fundedAt ? { key: "funded", at: deal.stamps.fundedAt } : null,
    deal.stamps.releaseRequestedAt ? { key: "release_requested", at: deal.stamps.releaseRequestedAt } : null,
    deal.stamps.releaseConfirmedAt ? { key: "released", at: deal.stamps.releaseConfirmedAt } : null,
    deal.receipt?.refundRequestedAt ? { key: "refund_requested", at: deal.receipt.refundRequestedAt } : null,
    deal.stamps.refundConfirmedAt ? { key: "refunded", at: deal.stamps.refundConfirmedAt } : null,
  ];
  return events
    .filter((e): e is ProtectedHistoryEvent => e !== null && Number.isFinite(Date.parse(e.at)))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/**
 * A protected payment's receipt as the one receipt model (`receipt-model.ts`),
 * so the sheet on screen, the PDF and the picture cannot disagree. It names
 * the custodian only in the provider's FULL wording, unaltered, with Vallo's
 * own line beside it; carries the partner's reference; and lists the release
 * or refund history with times. Pure and client-safe.
 */
export function protectedReceiptModel(deal: ProtectedDeal, stage: ProtectedStage, locale: Locale): ReceiptModel {
  const money = (minor: number) => formatMoney(minor, locale, "NGN");
  const quote = protectedQuote(deal.amountMinor);
  const facts = [
    { label: PROTECTED_REVIEW_ROWS.payer, value: deal.payerName },
    { label: PROTECTED_REVIEW_ROWS.payee, value: deal.payeeName },
    ...(deal.dates ? [{ label: PROTECTED_REVIEW_ROWS.dates, value: deal.dates }] : []),
    { label: PROTECTED_RECEIPT_ROWS.status, value: PROTECTED_STAGE_LABEL[stage] },
    ...(deal.receipt?.agreementVersion ? [{ label: PROTECTED_RECEIPT_ROWS.agreement, value: protectedAgreementVersion(deal.receipt.agreementVersion) }] : []),
    ...(deal.receipt?.providerReference ? [{ label: PROTECTED_RECEIPT_ROWS.providerReference, value: deal.receipt.providerReference }] : []),
  ];
  const lines = [
    { label: PROTECTED_REVIEW_ROWS.amount, value: money(deal.amountMinor) },
    ...(quote
      ? [
          {
            label: PROTECTED_REVIEW_ROWS.fee,
            value: quote.payer === "seller" ? `${money(quote.moneyInFeeMinor)}, ${PROTECTED_ROW_FEE_LISTER_PAYS.toLowerCase()}` : money(quote.moneyInFeeMinor),
          },
        ]
      : []),
  ];
  const paid = quote ? quote.buyerPaysMinor : deal.amountMinor;
  return {
    kind: PROTECTED_RECEIPT_TITLE,
    title: deal.place.title,
    place: deal.place.area,
    figureLabel: PROTECTED_RECEIPT_FIGURE,
    figure: money(paid),
    facts,
    lines,
    total: { label: PROTECTED_RECEIPT_TOTAL, value: money(paid) },
    confirmations: protectedHistory(deal).map((event) => ({
      label: PROTECTED_RECEIPT_EVENT[event.key],
      state: lagosTime(event.at, locale) ?? "",
    })),
    reference: { label: PROTECTED_RECEIPT_ROWS.reference, value: deal.reference },
    note: `${PROTECTED_FUNDS_WORDING_FULL} ${PROTECTED_WHERE_VALLO} ${PROTECTED_RECEIPT_NOTE}`,
  };
}
