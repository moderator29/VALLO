import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { formatMoney } from "@vallo/i18n/core";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { ButtonLink } from "@/components/ui/Button";
import { FundScreen } from "@/components/money/fund/FundScreen";
import { readFundPayment } from "@/lib/money/fund-view";
import { fundModel } from "@/lib/money/fund-model";
import { withNext } from "@/lib/auth/next-link";
import { FundControl } from "./FundControl";
import { SwitchToCard } from "./SwitchToCard";
import { readAgreementPayChoice } from "@/lib/payments/rail-choice-read";
import { protectedRailLive } from "@/lib/money/rail-live";
import { FUND_TITLE, PROTECTED_PAGE_TITLE } from "@/lib/money/copy";
import { readProtectedDeal } from "@/lib/money/protected-read";
import { ProtectedAgreementView, isFundingStage, protectedStageOf } from "@/components/money/protected/ProtectedAgreementView";

/**
 * STEP 7, FUND (D77): the renter pays the agreed rent on the protected rail,
 * from their Vallo balance, with one deliberate swipe. Hands off to
 * /agreements/[id]/held the moment the money is on its way.
 *
 * THE PROTECTED RAIL IS SWITCHED OFF (9 November 2026, sweep item 14): while
 * `escrowRailLive()` is false (read through `protectedRailLive()`, which fails
 * closed) this route sends the member to the agreement itself, before reading
 * anything, so no member is shown an escrow screen over a closed sentence.
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
     else while the switch is off. Null today on every deployment, so the
     page below runs exactly as it did. */
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
  if (!(await protectedRailLive())) redirect(`/agreements/${id}`);
  const [locale, read, payChoice] = await Promise.all([getLocale(), readFundPayment(id), readAgreementPayChoice(id)]);
  /* The way out to card, where the rules allow it (a purchase is escrow only;
     a closed or finished agreement has nothing to switch). */
  const cardAllowed =
    payChoice !== null &&
    payChoice.payer &&
    payChoice.options.includes("card") &&
    /* An escrow opened and never funded reads as a payment started; the
       action withdraws it at the partner first, and says so calmly when the
       money is moving or held instead. */
    (payChoice.locked === null || payChoice.locked === "payment_started");

  if (read.state === "signed-out") {
    return (
      <PageFrame title={FUND_TITLE} fallback="/agreements" width="narrow">
        <div className="px-md">
        <ButtonLink href={withNext("/sign-in", `/agreements/${id}/fund`)} variant="primary" full>
          Sign in to pay
        </ButtonLink>
        </div>
      </PageFrame>
    );
  }
  if (read.state === "unavailable") {
    return (
      <PageFrame title={FUND_TITLE} fallback={`/agreements/${id}`} width="narrow">
        <div className="px-md">
        <p className="nf-body">This could not be read just now. Nothing has been taken; refresh to try again.</p>
        </div>
      </PageFrame>
    );
  }
  if (read.state !== "ready") return notFound();

  const model = fundModel(read.facts);
  if (model.kind === "go_held") redirect(`/agreements/${id}/held`);

  return (
    <PageFrame title={FUND_TITLE} fallback={`/agreements/${id}`} width="narrow">
      <div className="px-md pb-2xl">
      <FundScreen
        facts={read.facts}
        model={model}
        locale={locale}
        backHref={`/agreements/${id}`}
        control={<FundControl agreementId={id} amountLabel={formatMoney(read.facts.amountMinor, locale, "NGN")} />}
        fallback={cardAllowed ? <SwitchToCard agreementId={id} /> : undefined}
      />
      </div>
    </PageFrame>
  );
}

/** The request's clock, read once so every time on the page agrees. */
function requestTime(): number {
  return Date.now();
}
