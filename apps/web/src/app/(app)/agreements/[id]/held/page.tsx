import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { PROTECTED_PAGE_TITLE } from "@/lib/money/copy";
import { readProtectedDeal } from "@/lib/money/protected-read";
import { ProtectedAgreementView, isFundingStage, protectedStageOf } from "@/components/money/protected-rail/ProtectedAgreementView";

/**
 * STEP 8, FUNDED: the screen that wins the market. A payer who sent a deposit
 * to somebody they met online sees, plainly, that the money is held by a
 * licensed provider and exactly what releases it; the lister sees the same
 * money held for them. Everything on it is the provider's record, read under
 * the viewer's own RLS through `readProtectedDeal`. With the protected rail
 * switched off, or no protected payment on the agreement, the member goes
 * back to the agreement.
 */
export const metadata: Metadata = { title: "Escrow payment" };
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function HeldPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  /* THE NEW PROTECTED RAIL (10 November 2026), built switched off: null
     unless payments_escrowpay_on is on, the arrangement is the new
     provider's and the category is approved, and it reads nothing while
     the switch is off. */
  const now = requestTime();
  const protectedDeal = await readProtectedDeal(id, now);
  if (protectedDeal) {
    if (protectedDeal.role === "payer" && isFundingStage(protectedStageOf(protectedDeal, now)) && protectedDeal.deal.status !== "failed") {
      redirect(`/agreements/${id}/fund`);
    }
    const protectedLocale = await getLocale();
    return (
      <PageFrame title={PROTECTED_PAGE_TITLE} fallback={`/agreements/${id}`} width="narrow">
        <div className="px-md pb-2xl">
          <ProtectedAgreementView read={protectedDeal} now={now} locale={protectedLocale} />
        </div>
      </PageFrame>
    );
  }
  /* No protected payment to show: the agreement itself says what to do. */
  redirect(`/agreements/${id}`);
}

/** The request's clock, read once so every time on the page agrees. */
function requestTime(): number {
  return Date.now();
}
