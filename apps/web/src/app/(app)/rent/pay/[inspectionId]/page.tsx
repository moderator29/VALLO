import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getRentPayView } from "@/lib/rent/queries";
import { isBookingReference } from "@/lib/payments/references";
import { listPaymentMethods } from "@/lib/payments/methods-actions";
import type { PaymentMethod } from "@/lib/payments/methods";
import { cryptoOfferForViewer } from "@/lib/crypto/offer";
import { ResultScreen } from "@/components/app/ResultSheet";
import { PageFrame } from "@/components/app/PageFrame";
import { ButtonLink } from "@/components/ui/Button";
import { PaidMoment } from "@/components/ui/SuccessMoment";
import { Reveal } from "@/components/site/Reveal";
import { PaymentReturn } from "@/app/(app)/checkout/[bookingId]/PaymentReturn";
import { PayPanel } from "./PayPanel";
import { RentSummary } from "./RentSummary";
import { RentLandlordFact } from "./RentLandlordFact";
import { chargeRentSavedCardFor } from "./saved-card-action";
import { withNext } from "@/lib/auth/next-link";
import { RENT_NOT_OPEN_NEXT, RENT_NOT_OPEN_SHORT } from "@/lib/money/copy";
import { RENT_PAYMENT_OPEN } from "@/lib/rent/payment-open";

export const metadata: Metadata = { title: "Pay the rent" };

/**
 * The rent payment step.
 *
 * Where the inspection journey ends on the platform: the move-in ledger the
 * listing page led with, now as the figure to pay, and the three ways to pay
 * it. Every figure is the listing's own move-in arithmetic in integer kobo,
 * frozen on the charge by the database the moment it opens, read under the
 * tenant's own RLS, so the amount on screen is the amount the payment actions
 * charge.
 *
 * The platform charges nothing, so the total is the lister's move-in figure
 * and nothing else. A rent paid by card comes back to this route as
 * ?paid=1&reference=rm-book-... exactly as a stay does, where `PaymentReturn`
 * verifies the charge and settles it through the identical function the
 * webhook calls.
 *
 * Every state that is not "ready to pay" is a designed, honest screen: no
 * keys yet, signed out, no such inspection, not accepted yet, no figure to
 * pay, the lister looking at the tenant's page, already paid. None is a crash
 * and none leaks a code.
 */
export default async function RentPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ inspectionId: string }>;
  searchParams: Promise<{ paid?: string; reference?: string }>;
}) {
  const { inspectionId } = await params;
  const { paid, reference } = await searchParams;
  const locale = await getLocale();
  const c = getDictionary(locale).checkout;
  const read = await getRentPayView(inspectionId, locale);

  const settling =
    paid === "1" && typeof reference === "string" && isBookingReference(reference) ? reference : null;

  if (read.state === "unconfigured") {
    return (
      <Shell>
        <ResultScreen
          state="pending"
          mark="card-lock"
          verdict={c.cannotReachPayment}
          consequence={c.cannotReachRent}
          actions={[{ label: c.seeInspections, href: "/bookings?kind=inspection&from=property", tone: "primary" }]}
        />
      </Shell>
    );
  }

  if (read.state === "signed-out") {
    return (
      <Shell>
        <ResultScreen
          state="sign-in"
          verdict={c.signInToPayRent}
          consequence={c.signInKeptRent}
          /* The sentence above promises a return here, so the link carries it:
             sign-in reads only `next` (Round 3 sweep, C3). */
          actions={[{ label: c.signIn, href: withNext("/sign-in", `/rent/pay/${encodeURIComponent(inspectionId)}`), tone: "primary" }]}
        />
      </Shell>
    );
  }

  if (read.state === "missing") {
    return (
      <Shell>
        <ResultScreen
          state="missing"
          verdict={c.inspectionNotFound}
          consequence={c.inspectionNotFoundBody}
          actions={[{ label: c.seeInspections, href: "/bookings?kind=inspection&from=property", tone: "primary" }]}
        />
      </Shell>
    );
  }

  if (read.state === "unavailable") {
    return (
      <Shell>
        <ResultScreen
          state="failed"
          mark="alert-triangle"
          verdict={c.rentStepDidNotOpen}
          consequence={c.rentStepDidNotOpenBody}
          actions={[{ label: c.seeInspections, href: "/bookings?kind=inspection&from=property", tone: "primary" }]}
        />
      </Shell>
    );
  }

  if (read.state === "not-tenant") {
    return (
      <Shell subtitle={read.title}>
        <ResultScreen
          state="confirmed"
          mark="shield-check"
          verdict={c.yourListing}
          consequence={c.yourListingBody}
          actions={[{ label: c.seeInspections, href: "/agent/inspections", tone: "primary" }]}
        />
      </Shell>
    );
  }

  if (read.state === "not-accepted") {
    return (
      <Shell subtitle={read.title}>
        <ResultScreen
          state="pending"
          mark="calendar-check"
          verdict={c.waitingOnLister}
          consequence={c.waitingOnListerBody}
          actions={[
            { label: c.seeInspections, href: "/bookings?kind=inspection&from=property", tone: "primary" },
            { label: c.backToListing, href: `/listing/${read.listingId}`, tone: "quiet" },
          ]}
        />
      </Shell>
    );
  }

  if (read.state === "no-charge") {
    return (
      <Shell subtitle={read.title}>
        <ResultScreen
          state="failed"
          mark="seal-cross"
          verdict={c.noFigure}
          consequence={c.noFigureBody}
          actions={[
            { label: c.openMessages, href: "/messages", tone: "primary" },
            { label: c.backToListing, href: `/listing/${read.listingId}`, tone: "quiet" },
          ]}
        />
      </Shell>
    );
  }

  const view = read.view;

  /*
   * THE RETURN FROM PAYSTACK, first in BOTH branches below. Settling moves
   * the charge to paid and refreshes, which re-renders this page down the
   * `view.paid` branch; rendered in only one of them, the receipt sheet was
   * unmounted the moment it had something to say. Same component at the same
   * place in both trees, so React keeps it, open, across the refresh.
   *
   * `kind="rent"` so the receipt says rent, not "your stay is confirmed", and
   * the booking id so a settlement against any other booking is not shown.
   */
  const returning = settling ? (
    <PaymentReturn
      reference={settling}
      bookingId={view.bookingId ?? ""}
      kind="rent"
      amountMinor={view.totalMinor}
      currency={view.currency}
      subject={view.title}
      locale={locale}
      retryHref={`/rent/pay/${inspectionId}`}
      plansAction={{ label: getDictionary(locale).shape.plans.seePlans, href: "/bookings?side=property&from=property" }}
    />
  ) : null;

  if (view.paid) {
    return (
      <Shell subtitle={view.title}>
        {returning}
        {/* The paid moment (D74 and references 4 and 7): the scalloped badge,
            what happened in one plain sentence, the one action and a quiet
            way back. Drawn only down `view.paid`; it decides nothing. */}
        <PaidMoment title={c.rentIsPaid} line={c.paidRent} to={view.title} testId="rent-paid-moment" />
        <div className="nf-receipt-actions">
          <ButtonLink href="/messages" variant="primary" size="lg" full>
            {c.openMessages}
          </ButtonLink>
          <ButtonLink href={`/listing/${view.listingId}`} variant="ghost" size="lg" full>
            {c.backToListing}
          </ButtonLink>
        </div>
        {/* V-32: the landlord's answer to these figures, as a dated fact,
            or nothing when no question was ever sent. Streams on its own. */}
        <div className="mt-block">
          <Suspense fallback={null}>
            <RentLandlordFact inspectionId={inspectionId} copy={getDictionary(locale).landlord.rentFact} locale={locale} />
          </Suspense>
        </div>
      </Shell>
    );
  }

  /* Payment for rentals is not open (9 November 2026, `lib/rent/payment-open`).
     The figures stay on screen so the renter knows what was agreed; no pay
     button is drawn, and the server actions behind it refuse on their own. */
  if (!RENT_PAYMENT_OPEN) {
    return (
      <Shell subtitle={view.title}>
        <Reveal>
          <RentSummary view={view} />
        </Reveal>
        <div className="mt-lg">
          <ResultScreen
            state="pending"
            mark="card-lock"
            verdict={RENT_NOT_OPEN_SHORT}
            consequence={RENT_NOT_OPEN_NEXT}
            actions={[
              { label: c.openMessages, href: "/messages", tone: "primary" },
              { label: c.backToListing, href: `/listing/${view.listingId}`, tone: "quiet" },
            ]}
          />
        </div>
      </Shell>
    );
  }

  /* PERF-SWEEP 2: two independent reads, together rather than in series.
     Crypto is decided on the server: null while it is off for the platform. */
  const [cardsRead, cryptoOffer] = await Promise.all([listPaymentMethods(), cryptoOfferForViewer()]);
  const savedCards: PaymentMethod[] = cardsRead.ok ? cardsRead.data : [];
  const savedCardKey = crypto.randomUUID();
  const chargeSavedCard = chargeRentSavedCardFor.bind(null, inspectionId, savedCardKey);

  return (
    <Shell subtitle={view.title}>
      {returning}

      <Reveal>
        <RentSummary view={view} />
      </Reveal>

      <div className="mt-lg">
        <PayPanel
          view={view}
          savedCards={savedCards}
          chargeSavedCard={chargeSavedCard}
          crypto={cryptoOffer}
          payCopy={getDictionary(locale).afterTheGate.pay}
        />
      </div>
    </Shell>
  );
}

async function Shell({ subtitle, children }: { subtitle?: string; children: React.ReactNode }) {
  const c = getDictionary(await getLocale()).checkout;
  return (
    <PageFrame title={c.rentTitle} subtitle={subtitle ?? c.rentSubtitle} fallback="/bookings?kind=inspection&from=property" width="narrow">
      {children}
    </PageFrame>
  );
}
