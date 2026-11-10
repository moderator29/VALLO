import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { FUND_TITLE, PROTECTED_PAGE_TITLE } from "@/lib/money/copy";
import { readProtectedDeal } from "@/lib/money/protected-read";
import { ProtectedAgreementView, isFundingStage, protectedStageOf } from "@/components/money/protected-rail/ProtectedAgreementView";

/**
 * STEP 7, FUND: the payer's funding screen on the protected rail. It draws
 * only from `readProtectedDeal`, which answers while the protected rail's
 * switch is on, the arrangement belongs to the rail and the deal's category
 * is approved. Anything else (the rail switched off, no protected payment on
 * this agreement) sends the member to the agreement itself, before reading
 * anything, so no member is shown a protected screen over a closed sentence.
 */
export const metadata: Metadata = { title: FUND_TITLE };
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FundPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  /* THE NEW PROTECTED RAIL (10 November 2026), built switched off. Its read
     answers only while payments_escrowpay_on is on, the arrangement is the
     new provider's and the deal's category is approved; it reads nothing
     else while the switch is off. */
  const now = requestTime();
  const protectedDeal = await readProtectedDeal(id, now);
  if (protectedDeal) {
    if (protectedDeal.role === "payer" && !isFundingStage(protectedStageOf(protectedDeal, now))) redirect(`/agreements/${id}/held`);
    const locale = await getLocale();
    return (
      <PageFrame title={PROTECTED_PAGE_TITLE} fallback={`/agreements/${id}`} width="narrow">
        <div className="px-md pb-2xl">
          <ProtectedAgreementView read={protectedDeal} now={now} locale={locale} />
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
