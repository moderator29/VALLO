import type { ReactNode } from "react";
import type { Locale } from "@vallo/i18n/core";
import {
  PROTECTED_LISTER_AMOUNT,
  PROTECTED_LISTER_NOT_BALANCE,
  PROTECTED_LISTER_PAYOUT,
  PROTECTED_LISTER_PAYOUT_CAPTION,
  PROTECTED_LISTER_STAGE,
} from "@/lib/money/copy";
import { stageFor } from "@/lib/money/protected-journey";
import { ListerIssue } from "./IssueScreen";
import { AmountHero, PlaceCard, ScreenHead, TimelineSpine, lagosTime, money } from "./kit";
import type { ProtectedDeal } from "./types";

/**
 * SCREEN 10, THE LISTER'S SIDE OF A PROTECTED PAYMENT (spec two). The same
 * payment, the same timeline, different words: the lister sees that the
 * payer has instructions, never that money arrived before the bank says so,
 * and never a spendable balance ("Protected transaction amount", spec).
 */
export function ListerProtectedView({
  deal,
  now,
  locale,
  children,
}: {
  deal: ProtectedDeal;
  now: number;
  locale: Locale;
  /** What the page adds under the timeline: the lister's own receipt once the payment is final. */
  children?: ReactNode;
}) {
  const stage = stageFor({
    status: deal.status,
    transferReported: deal.transferReported,
    fundingExpiresAt: deal.funding?.expiresAt ?? null,
    now,
  });
  /* After the release the money goes straight on to the lister's bank (automatic payout).
     Until the partner reports the transfer it is "on its way", never "paid". */
  const payout = stage === "released" ? (deal.payout?.status ?? "processing") : null;
  const paidOn = payout === "paid" ? lagosTime(deal.payout?.completedAt ?? null, locale) : null;
  const lead = payout
    ? payout === "paid" && paidOn
      ? PROTECTED_LISTER_PAYOUT.paid.replace("{date}", paidOn)
      : PROTECTED_LISTER_PAYOUT[payout === "paid" ? "processing" : payout]
    : PROTECTED_LISTER_STAGE[stage];
  /* What reached the bank, when the partner said how much: it may be the amount less its transfer fee. */
  const sent = payout === "paid" ? (deal.payout?.amountMinor ?? null) : null;
  const caption = !payout
    ? PROTECTED_LISTER_NOT_BALANCE
    : payout === "paid" && !paidOn
      ? PROTECTED_LISTER_PAYOUT_CAPTION.processing
      : payout === "paid" && sent !== null && sent !== deal.amountMinor
        ? PROTECTED_LISTER_PAYOUT_CAPTION.paidAmount.replace("{amount}", money(sent, locale))
        : PROTECTED_LISTER_PAYOUT_CAPTION[payout];
  return (
    <div className="nf-pp-screen" data-testid="pp-lister" data-stage={stage} data-payout={payout ?? undefined}>
      <ScreenHead eyebrow={PROTECTED_LISTER_AMOUNT} stage={stage} title={deal.place.title} lead={<p>{lead}</p>} />
      <ListerIssue deal={deal} />
      <AmountHero minor={deal.amountMinor} locale={locale} caption={caption} />
      <PlaceCard place={deal.place} />
      <TimelineSpine stage={stage} stamps={deal.stamps} milestone={deal.milestone} locale={locale} />
      {children}
    </div>
  );
}
