import type { ReactNode } from "react";
import type { Locale } from "@vallo/i18n/core";
import { PROTECTED_LISTER_AMOUNT, PROTECTED_LISTER_NOT_BALANCE, PROTECTED_LISTER_STAGE } from "@/lib/money/copy";
import { stageFor } from "@/lib/money/protected-journey";
import { ListerIssue } from "./IssueScreen";
import { AmountHero, PlaceCard, ScreenHead, TimelineSpine } from "./kit";
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
  return (
    <div className="nf-pp-screen" data-testid="pp-lister" data-stage={stage}>
      <ScreenHead eyebrow={PROTECTED_LISTER_AMOUNT} stage={stage} title={deal.place.title} lead={<p>{PROTECTED_LISTER_STAGE[stage]}</p>} />
      <ListerIssue deal={deal} />
      <AmountHero minor={deal.amountMinor} locale={locale} caption={PROTECTED_LISTER_NOT_BALANCE} />
      <PlaceCard place={deal.place} />
      <TimelineSpine stage={stage} stamps={deal.stamps} milestone={deal.milestone} locale={locale} />
      {children}
    </div>
  );
}
