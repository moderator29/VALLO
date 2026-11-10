"use client";

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Check";
import {
  PROTECTED_RELEASE_WHEN,
  PROTECTED_REVIEW_CHECKBOX,
  PROTECTED_REVIEW_CTA,
  PROTECTED_REVIEW_DISPUTE,
  PROTECTED_REVIEW_FULL,
  PROTECTED_REVIEW_HELD,
  PROTECTED_REVIEW_ROWS,
  PROTECTED_REVIEW_TITLE,
  PROTECTED_ROW_FEE_LISTER_PAYS,
  protectedReviewLead,
} from "@/lib/money/copy";
import { THIRD_PARTIES_LINE } from "@/lib/money/protected-wording";
import type { ProtectedQuote } from "@/lib/money/protected-fees";
import { DetailRows, PlaceCard, ScreenHead, money } from "./kit";
import type { ProtectedDeal } from "./types";

/**
 * SCREEN 2, REVIEW THE PROTECTION AGREEMENT (spec two). A separate step, not
 * hidden in the payment choice: the deal, both names, the amount, the dates,
 * when the money is released, the dispute path, refunds and the fee, then a
 * checkbox the payer ticks themselves. "Agree and continue" passes the exact
 * agreement version shown, which the server stores against the payment.
 */
export function ReviewProtection({
  deal,
  quote,
  agreementVersion,
  locale,
  onAgree,
  pending = false,
}: {
  deal: Pick<ProtectedDeal, "amountMinor" | "place" | "payerName" | "payeeName" | "dates" | "refundTerms" | "milestone" | "links">;
  quote: ProtectedQuote;
  agreementVersion: number;
  locale: Locale;
  onAgree: (agreementVersion: number) => void;
  pending?: boolean;
}) {
  const [agreed, setAgreed] = useState(false);
  const amount = money(deal.amountMinor, locale);
  const rows = [
    { label: PROTECTED_REVIEW_ROWS.property, value: deal.place.title },
    { label: PROTECTED_REVIEW_ROWS.payer, value: deal.payerName },
    { label: PROTECTED_REVIEW_ROWS.payee, value: deal.payeeName },
    { label: PROTECTED_REVIEW_ROWS.amount, value: amount, strong: true },
    ...(deal.dates ? [{ label: PROTECTED_REVIEW_ROWS.dates, value: deal.dates }] : []),
    { label: PROTECTED_REVIEW_ROWS.release, value: PROTECTED_RELEASE_WHEN[deal.milestone] },
    { label: PROTECTED_REVIEW_ROWS.refunds, value: deal.refundTerms },
    {
      label: PROTECTED_REVIEW_ROWS.fee,
      value:
        quote.payer === "seller"
          ? `${money(quote.moneyInFeeMinor, locale)}, ${PROTECTED_ROW_FEE_LISTER_PAYS.toLowerCase()}`
          : money(quote.moneyInFeeMinor, locale),
    },
  ];

  return (
    <div className="nf-pp-screen" data-testid="pp-review">
      <ScreenHead title={PROTECTED_REVIEW_TITLE} lead={<p>{protectedReviewLead(amount, deal.place.title)}</p>} />
      <PlaceCard place={deal.place} />
      <div className="nf-pp-prose">
        <p>{PROTECTED_REVIEW_HELD}</p>
        <p>{PROTECTED_REVIEW_DISPUTE}</p>
      </div>
      <DetailRows rows={rows} />
      <p className="nf-pp-fine">{THIRD_PARTIES_LINE}</p>
      <Link href={deal.links.agreement} className="nf-pp-link" data-testid="pp-review-agreement">
        {PROTECTED_REVIEW_FULL}
      </Link>
      <Checkbox checked={agreed} onChange={(e) => setAgreed(e.currentTarget.checked)} data-testid="pp-review-check">
        {PROTECTED_REVIEW_CHECKBOX}
      </Checkbox>
      <div className="nf-pp-actions">
        <Button
          variant="primary"
          size="lg"
          full
          disabled={!agreed || pending}
          onClick={() => onAgree(agreementVersion)}
          data-testid="pp-review-agree"
        >
          {PROTECTED_REVIEW_CTA}
        </Button>
      </div>
    </div>
  );
}
