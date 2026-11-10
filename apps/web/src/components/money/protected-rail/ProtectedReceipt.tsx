import type { Locale } from "@vallo/i18n/core";
import { ReceiptSheet } from "@/components/app/money/ReceiptSheet";
import { ReceiptActions } from "@/components/money/ReceiptActions";
import { stageFor } from "@/lib/money/protected-journey";
import { protectedReceiptModel } from "./receipt";
import type { ProtectedDeal } from "./types";
import "./pp-screens.css";

/**
 * A PROTECTED PAYMENT'S RECEIPT (BUILD 7.4; spec two, E): the one receipt
 * sheet and the one set of receipt actions, fed a protected model. It names
 * the custodian in the provider's full wording, carries the partner's
 * reference and the release or refund history, and keeps the help inside it.
 * Drawn only once the payment is final (released or refunded).
 */
export function ProtectedReceipt({ deal, now, locale, paymentHref }: { deal: ProtectedDeal; now: number; locale: Locale; paymentHref: string }) {
  const stage = stageFor({ status: deal.status, transferReported: deal.transferReported, fundingExpiresAt: deal.funding?.expiresAt ?? null, now });
  if (stage !== "released" && stage !== "refunded") return null;
  const receipt = protectedReceiptModel(deal, stage, locale);
  return (
    <section id="receipt" className="nf-pp-receipt" aria-label={receipt.kind} data-testid="pp-receipt">
      <ReceiptSheet
        receipt={receipt}
        headingId="pp-receipt-title"
        testId="pp-receipt-sheet"
        actions={
          <ReceiptActions
            receipt={receipt}
            testId="pp-receipt-actions"
            help={{ wrong: deal.links.help, where: paymentHref, who: `${deal.links.how}#who-holds-the-money` }}
          />
        }
      />
    </section>
  );
}
