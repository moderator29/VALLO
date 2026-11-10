import type { Locale } from "@vallo/i18n/core";
import { stageFor, type ProtectedStage } from "@/lib/money/protected-journey";
import type { ProtectedDealRead } from "@/lib/money/protected-read";
import { ListerProtectedView } from "./ListerProtectedView";
import { ProtectedPaymentLive } from "./ProtectedPaymentLive";
import { ProtectedReceipt } from "./ProtectedReceipt";

/**
 * The protected payment on the agreement's fund and held pages, for whoever
 * is looking: the payer's journey with its actions, or the lister's side.
 * The receipt follows once the bank confirmed the outcome. Server-safe; the
 * page decides when this is drawn (only when `readProtectedDeal` answered).
 */
export function ProtectedAgreementView({ read, now, locale }: { read: ProtectedDealRead; now: number; locale: Locale }) {
  const paymentHref = `/agreements/${read.agreementId}/held`;
  const stage = protectedStageOf(read, now);
  const final = stage === "released" || stage === "refunded";
  if (read.role === "lister") {
    return (
      <ListerProtectedView deal={read.deal} now={now} locale={locale}>
        <ProtectedReceipt deal={read.deal} now={now} locale={locale} paymentHref={paymentHref} />
      </ListerProtectedView>
    );
  }
  return (
    <>
      <ProtectedPaymentLive deal={read.deal} now={now} locale={locale} agreementId={read.agreementId} arrangementId={read.arrangementId} />
      {final ? (
        <div className="nf-pp-screen">
          <ProtectedReceipt deal={read.deal} now={now} locale={locale} paymentHref={paymentHref} />
        </div>
      ) : null}
    </>
  );
}

/** The screen a read draws, for the page's own routing between fund and held. */
export function protectedStageOf(read: ProtectedDealRead, now: number): ProtectedStage {
  const d = read.deal;
  return stageFor({ status: d.status, transferReported: d.transferReported, fundingExpiresAt: d.funding?.expiresAt ?? null, now });
}

/** Stages that belong on the funding page: the bank has not confirmed the money. */
export function isFundingStage(stage: ProtectedStage): boolean {
  return stage === "awaiting_transfer" || stage === "confirming" || stage === "expired" || stage === "failed";
}
