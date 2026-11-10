import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { ButtonLink } from "@/components/ui/Button";
import { readHeldPayment } from "@/lib/money/held-view";
import { withNext } from "@/lib/auth/next-link";
import { HeldPaymentBody } from "./HeldPaymentBody";
import { PROTECTED_PAGE_TITLE } from "@/lib/money/copy";
import { readProtectedDeal } from "@/lib/money/protected-read";
import { ProtectedAgreementView, isFundingStage, protectedStageOf } from "@/components/money/protected-rail/ProtectedAgreementView";

/**
 * STEP 8, FUNDED (D68d, B.3.5): the screen that wins the market. A renter in
 * Lagos who sent a deposit to somebody they met online sees, plainly, that the
 * money is held by a licensed provider and exactly what releases it; the
 * lister sees the same money held for them and what they will receive.
 * Everything on it is the provider's record, read under the viewer's own RLS:
 * no figure is computed here except the lister's take-home, which is the
 * amount less Payluk's reported fee and is shown only once Payluk reported it.
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
     the switch is off. Null today, so the page below is unchanged. */
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
  const [locale, read] = await Promise.all([getLocale(), readHeldPayment(id)]);

  if (read.state === "signed-out") {
    return (
      <PageFrame title="Escrow payment" fallback="/agreements" width="narrow">
        <div className="px-md">
        <ButtonLink
          href={withNext("/sign-in", `/agreements/${id}/held`)}
          variant="primary"
          full
        >
          Sign in to see it
        </ButtonLink>
        </div>
      </PageFrame>
    );
  }
  if (read.state === "unavailable") {
    return (
      <PageFrame title="Escrow payment" fallback={`/agreements/${id}`} width="narrow">
        <div className="px-md">
        <p className="nf-body">
          This could not be read just now. Nothing has moved; refresh to try
          again.
        </p>
        </div>
      </PageFrame>
    );
  }

  if (read.state !== "ready") return notFound();
  const f = read.facts;
  /* D77: not paid in yet, the renter's next step is the funding screen. */
  if (f.role === "renter" && f.status === "awaiting_payment")
    redirect(`/agreements/${id}/fund`);

  return (
    <PageFrame title="Escrow payment" fallback={`/agreements/${id}`} width="narrow">
      <div className="px-md pb-2xl">
      <HeldPaymentBody
        facts={f}
        locale={locale}
        agreementId={read.agreementId}
        arrangementId={read.arrangementId}
      />
      </div>
    </PageFrame>
  );
}

/** The request's clock, read once so every time on the page agrees. */
function requestTime(): number {
  return Date.now();
}
