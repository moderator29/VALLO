import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@vallo/i18n";
import { getCheckoutView } from "@/lib/bookings/checkout-view";
import { isBookingReference } from "@/lib/payments/references";
import { ResultScreen } from "@/components/app/ResultSheet";
import { SegmentedProgress } from "@/components/ui/Progress";
import { PageHeader } from "@/components/app/PageHeader";
import { PageScene } from "@/components/app/PageScene";
import { Reveal } from "@/components/site/Reveal";
import { CancellationTimeline } from "@/lib/trust/CancellationTimeline";
import { BrandIcon } from "@/design-system/icons/BrandIcon";
import { panelClass } from "@/components/ui/Panel";
import { CheckoutSummary } from "./CheckoutSummary";
import { CheckoutPaidMoment } from "./CheckoutPaidMoment";
import { ArrivalChargesLine } from "@/components/stays/ArrivalChargesLine";
import { bookingChargeKind } from "@/lib/after-gate/is-rent-charge";
import { HoldCountdown } from "./HoldCountdown";
import { PayPanel } from "./PayPanel";
import { PaymentReturn } from "./PaymentReturn";
import { chargeSavedCardFor } from "./saved-card-action";
import { listPaymentMethods } from "@/lib/payments/methods-actions";
import type { PaymentMethod } from "@/lib/payments/methods";
import { cryptoOfferForViewer } from "@/lib/crypto/offer";
import { TransactionCheckout } from "@/components/money/TransactionCheckout";
import { CHECKOUT_CONDITION_APPROVED, CHECKOUT_CONDITION_CANCEL } from "@/lib/money/copy";
import { LIVE_RAIL } from "@/lib/money/rails";
import type { MoneyReference } from "@/lib/money/references";
import { withNext } from "@/lib/auth/next-link";
import { readBookedPolicyTerms } from "@/lib/stays/booked-policy";
import { readAgreementPayChoice } from "@/lib/payments/rail-choice-read";
import { PayChoiceCard } from "@/components/money/pay-choice/PayChoiceCard";

export const metadata: Metadata = { title: "Checkout" };

/**
 * Checkout.
 *
 * The screen that turns a reserved stay into a paid one: what is being bought,
 * how long the dates are held, and the two ways to pay. Every figure is the
 * booking's own stored total in integer kobo, read under the guest's own RLS, so
 * the amount on screen is the amount the server actions charge.
 *
 * Nothing is added to a guest's price (HANDOFF.md section 2), so the total
 * paid here is the stay and nothing else; every charge the host may ask for
 * at the door is drawn above the pay action with the all-in figure.
 *
 * Paystack sends the guest back to this same route as
 * ?paid=1&reference=rm-book-..., where PaymentReturn verifies the charge and
 * settles it through the identical function the webhook calls. Whichever arrives
 * first wins and the second is a no-op.
 *
 * Every state that is not "ready to pay" is a designed, honest screen: no keys
 * yet, signed out, no such booking, already paid, cancelled, or a read that
 * could not complete. None of them is a crash and none of them leaks a code.
 */
export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ paid?: string; reference?: string }>;
}) {
  const { bookingId } = await params;
  const { paid, reference } = await searchParams;
  const locale = await getLocale();
  const plans = getDictionary(locale).shape.plans;
  const staysAction = { label: plans.seeStays, href: "/bookings?side=stays&from=stays" };
  const c = getDictionary(locale).checkout;
  const read = await getCheckoutView(bookingId, locale);

  const settling =
    paid === "1" && typeof reference === "string" && isBookingReference(reference)
      ? reference
      : null;

  /* ------------------------------------------------------- honest states */

  if (read.state === "unconfigured") {
    return (
      <Shell>
        {/* "Payment switches on shortly" was infrastructure jargon shown to
            somebody trying to pay, and it is the most expensive instance of
            the thirteen because of who is reading it. It says what is true and
            what has happened to the money instead. */}
        <ResultScreen
          state="pending"
          mark="card-lock"
          verdict={c.cannotReachPayment}
          consequence={c.cannotReachStay}
          actions={[{ label: staysAction.label, href: staysAction.href, tone: "primary" }]}
        />
      </Shell>
    );
  }

  if (read.state === "signed-out") {
    return (
      <Shell>
        <ResultScreen
          state="sign-in"
          verdict={c.signInToPayStay}
          consequence={c.signInKeptStay}
          /* The sentence above promises a return here, so the link carries it:
             sign-in reads only `next` (Round 3 sweep, C3). */
          actions={[{ label: c.signIn, href: withNext("/sign-in", `/checkout/${encodeURIComponent(bookingId)}`), tone: "primary" }]}
        />
      </Shell>
    );
  }

  if (read.state === "missing") {
    return (
      <Shell>
        {/* A CROSS, NOT A TICK, AND ROSE, NOT CYAN. This said "We could not
            find that booking" under `calendar-check`, a calendar with a TICK,
            inside a cyan glow: a success mark and the pending colour, both
            contradicting the sentence between them. */}
        <ResultScreen
          state="missing"
          verdict={c.bookingNotFound}
          consequence={c.bookingNotFoundBody}
          actions={[{ label: staysAction.label, href: staysAction.href, tone: "primary" }]}
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
          verdict={c.checkoutDidNotOpen}
          consequence={c.checkoutDidNotOpenBody}
          actions={[{ label: staysAction.label, href: staysAction.href, tone: "primary" }]}
        />
      </Shell>
    );
  }

  const view = read.view;

  /* The saved-card lane. The cards are read here, on the server, and the
     charge is bound to this booking and to one key minted per render, the
     way the wallet and hosted-card paths mint theirs inside the panel. A
     failed read offers no saved card rather than an empty group. */
  /* PERF-SWEEP 2: the saved cards, the crypto offer and the charge kind are
     three independent reads; they run together rather than in series, and
     the charge kind is read once rather than once per use below. */
  const [cardsRead, cryptoOffer, chargeKind, bookedTerms, payChoice] = await Promise.all([
    listPaymentMethods(),
    /* Crypto, decided here on the server: null while it is off for the platform. */
    cryptoOfferForViewer(),
    bookingChargeKind(view.bookingId),
    /* The cancellation policy on the rate being booked (Flexible to Strict),
       drawn against these dates; null draws the platform schedule. */
    readBookedPolicyTerms(view.bookingId),
    /* Ruling 2 (13 October 2026): escrow or card, the payer's pick, on an
       approved agreement not yet paid. Null draws today's screen. */
    view.agreement?.status === "approved" && !view.paid ? readAgreementPayChoice(view.agreement.id) : Promise.resolve(null),
  ]);
  /* Escrow (the default, or the payer's pick) is paid on the escrow step, so
     the card panel is drawn only when card is the rail. */
  const escrowChosen =
    payChoice !== null &&
    ((payChoice.options.length > 1 && payChoice.rail === "escrow") ||
      /* Escrow paused (protectedRailLive false): card is offered instead, and
         the card panel opens once the payer has stored card as their choice. */
      (payChoice.escrowPaused === true && payChoice.chosen !== "card"));
  const savedCards: PaymentMethod[] = cardsRead.ok ? cardsRead.data : [];
  const savedCardKey = crypto.randomUUID();
  const chargeSavedCard = chargeSavedCardFor.bind(null, bookingId, savedCardKey);

  /* ----------------------------------------------------------- the screen */

  return (
    <Shell subtitle={view.title}>
      {settling && (
        /* The sheet carries the amount and the property, because a
           confirmation is a thing people screenshot and "Payment received" on
           its own is not worth keeping. */
        <PaymentReturn
          reference={settling}
          bookingId={bookingId}
          amountMinor={view.totalMinor}
          currency={view.currency}
          subject={view.title}
          locale={locale}
          retryHref={`/checkout/${bookingId}`}
          plansAction={staysAction}
        />
      )}

      {/*
        Where you are in the booking.

        Checkout had no step indication at all - you arrived from a listing,
        were asked for money, and nothing on screen said how much further there
        was to go or that anything had already been done. Every multi-step flow
        in the reference set carries a segmented bar at the very top, and the
        agent's listing wizard already had one; this is the flow where its
        absence costs the most, because the step after it takes payment.

        Three steps, and the labels are honest about what they are: the dates
        were chosen on the listing, this screen reviews and pays, and
        confirmation follows. Not rendered while settling - a payment coming
        back from Paystack is past the point where a progress bar helps.
      */}
      {!settling && !view.paid && (
        <Reveal>
          <div className="mb-md">
            <SegmentedProgress
              steps={3}
              current={2}
              label={c.step}
            />
          </div>
        </Reveal>
      )}

      {/* Paid: the moment first, then the receipt (references 4 and 7), with
          "Download receipt" and the quiet way back to the stays under it. */}
      {view.paid ? (
        <Reveal>
          <CheckoutPaidMoment view={view} locale={locale} />
        </Reveal>
      ) : null}

      <Reveal delay={view.paid ? 80 : 0}>
        {/* What is being bought, as one component the preview harness draws
            with fixture props and this route draws with the real read. */}
        {/* No stay terms on a rent charge, nor when that could not be read. */}
        <CheckoutSummary view={view} locale={locale} tenancy={chargeKind !== "stay"} back={view.paid ? staysAction : undefined} />
      </Reveal>

      {/* V-57 and product rule 2: every cost before the action that pays.
          What the host declared for the door, worked out for these nights and
          this party, with the all-in figure, straight under the total and
          above the pay action (it used to sit under the pay panel, where a
          guest could pay without having scrolled to it). */}
      {view.status !== "CANCELLED" && chargeKind === "stay" && (
        <div className="mt-md">
          <ArrivalChargesLine
            listingId={view.listingId}
            accommodationId={view.accommodationId}
            bookingId={view.bookingId}
            locale={view.locale}
            stay={{ nights: view.nights, guests: view.guests, priceMinor: view.totalMinor }}
          />
        </div>
      )}

      {view.paid ? null : view.status === "CANCELLED" ? (
        <Reveal delay={80} className="mt-md">
          {/* EXPIRED, NOT FAILED, AND NOT A TICK. A cancellation is terminal
              and it is not a failure: nothing went wrong, a window closed.
              Painting it rose would manufacture alarm, and painting it cyan
              said it was still in progress. It was also marked with a tick. */}
          <ResultScreen
            state="expired"
            verdict={c.bookingCancelled}
            consequence={c.bookingCancelledBody}
            actions={[
              { label: c.backToStay, href: view.stayHref, tone: "primary" },
            ]}
          />
        </Reveal>
      ) : (
        <>
          <Reveal delay={80} className="mt-md">
            {/*
              ONE BRANCH PER LIFECYCLE VALUE, AND THERE ARE FIVE OF THEM NOW.

              `booking_status` gained COMPLETED and NO_SHOW. This was a single
              ternary on CONFIRMED with everything else falling through to the
              hold clock, so a stay the agent had already recorded as finished
              would have rendered a countdown towards a hold that expired days
              ago. CANCELLED is answered further up, which leaves four here and
              all four are named rather than defaulted: the next value added to
              the enum should be a visible gap, not a silently wrong screen.
            */}
            {view.status === "PENDING" ? (
              <HoldCountdown expiresAt={view.holdExpiresAt} locale={locale} />
            ) : view.status === "CONFIRMED" && view.instantPayBy && !view.paid ? (
              /* D73: booked instantly at the published price. The room is
                 held for a short window while the guest pays, and the sweep
                 gives it back after, so here the clock is real. */
              <HoldCountdown expiresAt={view.instantPayBy} locale={locale} />
            ) : view.status === "CONFIRMED" ? (
              /* Confirmed and still unpaid means the agent accepted a request to
                 book. There is no hold running out, so counting one down would
                 be a fiction. What this guest needs to know is that the stay is
                 theirs and the money is what is outstanding. */
              <HoldNote>
                {c.acceptedNote}
              </HoldNote>
            ) : view.status === "COMPLETED" ? (
              <HoldNote>
                {c.completedNote}
              </HoldNote>
            ) : (
              /* NO_SHOW. Said without accusing the reader of anything: the
                 record is the agent's and the guest may well disagree with it,
                 so the route to a person comes before the route to a payment. */
              <HoldNote>
                {c.noShowNote}
              </HoldNote>
            )}
          </Reveal>

          {/*
            NOT INSIDE A `Reveal`, AND THAT IS LOAD BEARING RATHER THAN A
            STYLE PREFERENCE.

            `PayPanel` now pins the pay action in an `ActionBar`, which is
            `position: fixed`. `.nf-reveal` carries a permanent `will-change:
            opacity, transform` until it is shown, and any of those properties
            makes an element the containing block for fixed descendants, so
            wrapped in one the pinned bar would anchor to this section instead
            of to the viewport and land in the wrong place at the wrong size.
            `animation.css` records the same trap catching the wallet drawer
            once already.

            It also should not fade in: this is the control the screen exists
            for, and content that only exists once an IntersectionObserver has
            fired is content that sometimes does not exist.
          */}
          {/* D50: what this payment is, before the action that makes it. The
              rail is the one live payments open on (lib/money/rails.ts), so a
              direct payment is never described as held. */}
          <div className="mt-block">
            <TransactionCheckout
              rail={LIVE_RAIL}
              space={{ title: view.title, location: view.location, href: view.stayHref }}
              agreement={view.agreement ? { id: view.agreement.id, status: view.agreement.status } : null}
              payeeName={view.payeeName ?? null}
              amountMinor={view.totalMinor}
              currency={view.currency}
              locale={locale}
              conditions={[
                ...(view.agreement?.status === "approved" ? [CHECKOUT_CONDITION_APPROVED] : []),
                ...(chargeKind === "stay" ? [CHECKOUT_CONDITION_CANCEL] : []),
              ]}
              references={[
                ...(view.agreement
                  ? [{ kind: "agreement", value: view.agreement.id, href: `/agreements/${view.agreement.id}` } satisfies MoneyReference]
                  : []),
                { kind: "space", value: view.listingId ?? view.accommodationId ?? "", href: view.stayHref } satisfies MoneyReference,
              ]}
            />
          </div>

          {payChoice && view.agreement ? (
            <div className="mt-block">
              <PayChoiceCard
                copy={getDictionary(locale).payChoice}
                choice={payChoice}
                agreement={{ id: view.agreement.id, kind: chargeKind === "stay" ? "stay" : "rent", bookingId: view.bookingId, inspectionId: null }}
                here={`/checkout/${bookingId}`}
                showContinue={payChoice.options.length > 1 || (payChoice.escrowPaused === true && payChoice.chosen !== "card")}
              />
            </div>
          ) : null}

          {escrowChosen ? null : (
            <div className="mt-block">
              <PayPanel view={view} savedCards={savedCards} chargeSavedCard={chargeSavedCard} plansAction={staysAction} crypto={cryptoOffer} />
            </div>
          )}
        </>
      )}

      {/*
        The cancellation schedule, against THESE dates and THIS total, on the
        screen where the money moves (inbox item 66).

        The timeline component has existed for a while and rendered only on the
        cancellation page and in the safety centre, which are the two places
        somebody goes AFTER they want out. The point of a timeline rather than a
        paragraph is that it can be read in four seconds while deciding, so it
        belongs here, where the guest is about to pay and the boundary dates are
        real rather than abstract. Not shown once a stay is paid or cancelled:
        by then the schedule is support's business and there is a person on it.
      */}
      {!view.paid && view.status !== "CANCELLED" && (
        <Reveal delay={180} className="mt-xl">
          <CancellationTimeline
            checkIn={view.checkIn}
            totalMinor={view.totalMinor}
            locale={view.locale}
            headingLevel="h2"
            terms={chargeKind === "stay" ? bookedTerms : null}
          />
        </Reveal>
      )}

      <Reveal delay={200} className="mt-lg">
        <p className="flex items-start gap-sm text-[length:var(--nf-text-overline)] leading-relaxed text-[var(--nf-content-muted)]">
          <span className="mt-3xs block h-5 w-5 shrink-0">
            <BrandIcon name="naira-hand" fill tile={false} />
          </span>
          <span>
            {c.recordedOnce}
          </span>
        </p>
      </Reveal>
    </Shell>
  );
}

/**
 * A standing fact about the dates, where a countdown would be a fiction.
 *
 * One component rather than three copies of the same card, because the three
 * that use it differ only in their sentence and three hand-written copies is
 * how one of them ends up a different size from the other two.
 */
function HoldNote({ children }: { children: React.ReactNode }) {
  return (
    <p className={panelClass({ variant: "card", className: "flex-row items-start gap-sm text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]" })}>
      <span className="mt-3xs block h-5 w-5 shrink-0">
        <BrandIcon name="calendar-check" fill tile={false} />
      </span>
      <span>{children}</span>
    </p>
  );
}

/** The page frame, shared by every state so the chrome never jumps. */
async function Shell({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  const c = getDictionary(await getLocale()).checkout;
  return (
    <div className="nf-cat-surface mx-auto max-w-2xl">
      <div className="relative">
        <PageScene art="calendar-check" />
        <PageHeader title={c.title} subtitle={subtitle} fallback="/bookings?side=stays&from=stays" />
      </div>
      {children}
    </div>
  );
}
