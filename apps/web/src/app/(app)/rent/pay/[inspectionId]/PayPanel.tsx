"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePhoneGateAction } from "@/components/app/PhoneGateLink";
import { startCardCheckout } from "@/lib/bookings/checkout";
import { PaymentGate } from "@/components/app/agreements/PaymentGate";
import { NO_CUSTODY_SENTENCE, RAIL_COPY } from "@/lib/money/copy";
import { LIVE_RAIL } from "@/lib/money/rails";
import { startRentPayment } from "@/lib/rent/actions";
import { VERIFY_ACTION } from "@/lib/identity/listing-verification-rule";
import type { RentPayView } from "@/lib/rent/queries";
import { ResultSheet } from "@/components/app/ResultSheet";
import { SuccessSheet } from "@/components/ui/SuccessSheet";
import { successCopy } from "@/lib/ui/success-moments";
import { PaystackCheckout } from "@/components/app/payments/PaystackCheckout";
import { paymentState } from "@/lib/payments/payment-state";
import { SavedCardPicker } from "@/components/app/payments/SavedCardPicker";
import { preselectedCardId } from "@/components/app/payments/format";
import { savedCardMoment, type SavedCardPhase } from "@/components/app/payments/saved-card-copy";
import type { PaymentMethod } from "@/lib/payments/methods";
import type { ChargeSavedCardOutcome } from "@/lib/payments/charge-saved-card";
import type { ActionResult } from "@/lib/actions/envelope";
import { failureConsequence } from "@/app/(app)/checkout/[bookingId]/payment-copy";
import { Button } from "@/components/ui/Button";
import { ActionBar } from "@/components/ui/ActionBar";
import { Amount } from "@/components/ui/Amount";
import { BrandIcon, type BrandIconName } from "@/design-system/icons/BrandIcon";
import { UiIcon } from "@/design-system/icons/UiIcon";
import type { Dictionary } from "@vallo/i18n/core";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { CryptoPayOption } from "@/components/app/payments/crypto/CryptoPayOption";
import type { CryptoOffer } from "@/components/app/payments/crypto/offer";

/**
 * The three ways to pay the rent.
 *
 * Modelled on the checkout's PayPanel and riding the same actions: a saved
 * card or a hosted card page, each carrying the split that settles the
 * lister's share straight to the lister (Track A: there is no wallet). The one thing this
 * screen does that checkout does not is OPEN THE CHARGE FIRST. A tenant
 * arrives here from an accepted inspection with no bookings row behind them
 * yet, so every pay button calls `startRentPayment` (idempotent: one charge
 * per inspection) and only then hands the booking it returns to the payment
 * action. Neither step prices anything: the figure is the listing's own
 * move-in arithmetic, frozen on the charge by the database and read again by
 * the payment action for itself.
 *
 * One idempotency key is minted per method per mount, so the second of two
 * taps on a flaky connection replays the first answer instead of paying
 * twice. The pending, stalled, failed and paid states are the checkout's own
 * result sheets, with tenancy words ("arrange the keys"), never "these dates
 * are yours", and never a claim that anybody has been paid out (V-33).
 */

function newKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `k-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

const SLOW_MS = 10_000;
const GIVE_UP_MS = 25_000;

type Phase =
  | { kind: "idle" }
  | { kind: "opening" }
  | { kind: "saved-card-charging" }
  /* Both card paths carry the same three things, because they are the same
     transaction resumed the same way: see the note on the stay checkout's
     Phase. The 3DS one keeps the caller's original reference. */
  | { kind: "saved-card-hosted"; authorizationUrl: string; accessCode: string; reference: string }
  | { kind: "card-starting" }
  | { kind: "checkout-open"; accessCode: string; reference: string; authorizationUrl: string }
  /* Settled against this move-in, with the reference the receipt shows. */
  | { kind: "paid"; reference: string }
  /* Charged on the saved card and not yet applied: never "paid", never
     "not charged" (docs/SUCCESS_MOMENTS.md). */
  | { kind: "applying"; reference: string }
  | { kind: "stalled"; method: "card" }
  | { kind: "error"; message: string; phoneGate?: boolean; verifyGate?: boolean };

function Option({
  icon,
  title,
  body,
  action,
  note,
}: {
  icon: BrandIconName;
  title: string;
  body: string;
  action?: React.ReactNode;
  note?: string;
}) {
  return (
    <li className="nf-panel nf-panel--card flex-row items-start gap-group p-card">
      <span className="block h-12 w-12 shrink-0">
        <BrandIcon name={icon} fill />
      </span>
      <div className="min-w-0 flex-1">
        <p className="nf-body font-semibold text-[var(--nf-content-primary)]">{title}</p>
        <p className="nf-body-sm mt-inline-tight leading-relaxed text-[var(--nf-content-secondary)]">
          {body}
        </p>
        {note && (
          <p className="nf-body-sm mt-inline leading-relaxed text-[var(--nf-content-muted)]">{note}</p>
        )}
        {action && <div className="mt-row">{action}</div>}
      </div>
    </li>
  );
}

export function PayPanel({
  view,
  savedCards = [],
  chargeSavedCard,
  payCopy,
  crypto = null,
}: {
  view: RentPayView;
  /** Pay with crypto (lib/crypto), decided on the server. Null while crypto is off. */
  crypto?: CryptoOffer | null;
  /** V-25: the large-payment sentences, from `t.afterTheGate.pay`. */
  payCopy?: Dictionary["afterTheGate"]["pay"];
  savedCards?: PaymentMethod[];
  /**
   * The saved-card charge, bound by the page to this inspection and one key.
   * The page resolves the booking behind the inspection on the server, so
   * the browser never names a booking to charge.
   */
  chargeSavedCard?: (methodId: string) => Promise<ActionResult<ChargeSavedCardOutcome>>;
}) {
  /* From the route's CopyScope (W13): no client dictionary read. */
  const c = useScopedCopy("checkout");
  const s = useScopedCopy("success");
  const paid = successCopy(s, "rentPaid");
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const phoneGateAction = usePhoneGateAction();
  const [slow, setSlow] = useState(false);
  const cardKey = useMemo(() => newKey(), []);
  const timers = useRef<number[]>([]);

  const [chosenCard, setChosenCard] = useState<string | null>(() => preselectedCardId(savedCards));
  const savedCardsOffered = Boolean(chargeSavedCard) && chosenCard !== null;
  const hostedPhase: SavedCardPhase =
    phase.kind === "saved-card-hosted"
      ? { kind: "needs_hosted", authorizationUrl: phase.authorizationUrl }
      : { kind: "needs_hosted", authorizationUrl: "" };

  const busy =
    phase.kind === "opening" ||
    phase.kind === "saved-card-charging" ||
    phase.kind === "card-starting" ||
    phase.kind === "checkout-open";

  /* V-25. Above the threshold the one page that can take a transfer leads
     with it, and says why a card is likely to be refused. */
  const largeLead = view.routes.leadWithTransfer && payCopy !== undefined ? payCopy : null;

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const startClocks = (method: "card") => {
    clearTimers();
    setSlow(false);
    timers.current.push(window.setTimeout(() => setSlow(true), SLOW_MS));
    timers.current.push(
      window.setTimeout(() => {
        setSlow(false);
        setPhase({ kind: "stalled", method });
      }, GIVE_UP_MS),
    );
  };

  /** The charge behind this inspection, opened if it is not open yet. */
  const openCharge = async (): Promise<string | null> => {
    if (view.bookingId && view.chargeOpen) return view.bookingId;
    setPhase({ kind: "opening" });
    const opened = await startRentPayment({ inspectionId: view.inspectionId, moveIn: view.moveIn });
    if (!opened.ok) {
      clearTimers();
      setPhase({ kind: "error", message: opened.error, phoneGate: opened.gate === "phone", verifyGate: opened.gate === "verification" });
      return null;
    }
    return opened.data.bookingId;
  };

  const payBySavedCard = async () => {
    if (!chargeSavedCard || !chosenCard) return;
    startClocks("card");
    const bookingId = await openCharge();
    if (!bookingId) return;
    setPhase({ kind: "saved-card-charging" });
    const result = await chargeSavedCard(chosenCard);
    clearTimers();
    if (!result.ok) {
      setPhase({ kind: "error", message: result.error, phoneGate: result.gate === "phone", verifyGate: result.gate === "verification" });
      return;
    }
    if (result.data.kind === "needs_hosted_checkout") {
      /* The bank wants to authenticate. Same reference, same transaction,
         opened in our own window rather than on the bank's own page. */
      setPhase({
        kind: "saved-card-hosted",
        authorizationUrl: result.data.authorizationUrl,
        accessCode: result.data.accessCode,
        reference: result.data.reference,
      });
      return;
    }
    /* `settled` is the server's word that the charge was applied to this
       move-in; without it the success sheet waits. */
    setPhase(
      result.data.settled
        ? { kind: "paid", reference: result.data.reference ?? "" }
        : { kind: "applying", reference: result.data.reference ?? "" },
    );
    /* A settled charge refreshes when its receipt closes: refreshing now
       re-renders the page down its paid branch, which does not mount this
       panel, and took the receipt away the moment it opened. */
    if (!result.data.settled) router.refresh();
  };

  const payByCard = async () => {
    startClocks("card");
    const bookingId = await openCharge();
    if (!bookingId) return;
    setPhase({ kind: "card-starting" });
    const result = await startCardCheckout({ bookingId, idempotencyKey: cardKey });
    if (result.ok && result.data) {
      /* The clocks stop here: they covered the gap to a navigation that no
         longer happens, and leaving them running would call the payment
         stalled while the person was typing their PIN. */
      clearTimers();
      setPhase({
        kind: "checkout-open",
        accessCode: result.data.accessCode,
        reference: result.data.reference,
        authorizationUrl: result.data.authorizationUrl,
      });
      return;
    }
    clearTimers();
    setPhase({
      kind: "error",
      message: result.ok ? c.pageNotOpened : result.error,
    });
  };

  const panel = (
    <section aria-labelledby="nf-rent-pay">
      <h2 id="nf-rent-pay" className="nf-h3">
        {c.howToPay}
      </h2>
      <ul className="mt-block grid gap-row">
        {savedCardsOffered && (
          <Option
            icon="card-lock"
            title={c.savedCardTitle}
            body={c.savedCardBody}
            action={
              <div>
                <SavedCardPicker
                  cards={savedCards}
                  value={chosenCard}
                  onChange={setChosenCard}
                  disabled={busy}
                />
                <Button
                  variant="primary"
                  full
                  className="mt-row"
                  onClick={payBySavedCard}
                  disabled={busy || chosenCard === null}
                  loading={phase.kind === "saved-card-charging"}
                  /* Motion 7, on real phases only: the arc while the server is
                     asked, the tick once the settlement says paid. */
                  morph
                  done={phase.kind === "paid"}
                >
                  {c.payWithThisCard}
                </Button>
              </div>
            }
          />
        )}
        {view.cardAvailable ? (
          <Option
            icon="card-lock"
            title={largeLead ? largeLead.largeLead : c.cardTitle}
            body={
              largeLead
                ? largeLead.largeBody
                : c.cardBody
            }
            note={largeLead ? largeLead.largeNote.replace("{amount}", view.totalDisplay) : undefined}
            action={
              <Button
                variant="primary"
                full
                onClick={payByCard}
                disabled={busy}
                loading={phase.kind === "card-starting"}
                morph
                done={phase.kind === "paid"}
              >
                {largeLead ? largeLead.largeLead : c.payByCard}
              </Button>
            }
          />
        ) : (
          <Option
            icon="card-lock"
            title={c.cardTitle}
            body={c.cardUnavailable}
            note={c.cardUnavailableRentNote}
          />
        )}
        {/* Pay with crypto, once the rent charge exists: the provider settles
            naira to the same legs. Absent unless the server opened it. */}
        {crypto && view.bookingId && view.chargeOpen && (
          <CryptoPayOption offer={crypto} bookingId={view.bookingId} totalMinor={view.totalMinor} locale={view.locale} />
        )}
      </ul>
      <p className="nf-caption mt-block leading-relaxed text-[var(--nf-content-muted)]" data-testid="rent-no-custody">
        {NO_CUSTODY_SENTENCE} {RAIL_COPY[LIVE_RAIL].standing}
      </p>
      <p className="nf-caption mt-block flex items-start gap-inline leading-relaxed text-[var(--nf-content-muted)]">
        {/* Advice, so a neutral glyph: the shield means an earned check (A9). */}
        <UiIcon name="info" size="xs" className="mt-3xs shrink-0" />
        <span>{c.onPlatformRent}</span>
      </p>
      {/* The spacer is the section's LAST in-flow child, so the fixed bar
          below never covers a line of copy. Its height is the bar's own
          (5.5rem) plus the home-indicator inset the bar pads itself by. */}
      <div
        aria-hidden="true"
        data-testid="pay-bar-spacer"
        style={{ height: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" }}
      />
      <ActionBar>
        <p className="flex min-w-0 flex-1 flex-col">
          <span className="nf-caption text-[var(--nf-content-muted)]">{c.moveInTotal}</span>
          <span className="min-w-0">
            <Amount
              minorUnits={view.totalMinor}
              locale={view.locale}
              currency={view.currency}
              showFraction
              className="text-[length:var(--nf-text-body-lg)] font-bold leading-none tracking-[-0.02em] text-[var(--nf-content-primary)]"
              secondaryClassName="text-[length:var(--nf-text-overline)] font-semibold text-[var(--nf-content-muted)]"
            />
          </span>
        </p>
        {view.cardAvailable ? (
          <Button
            variant="primary"
            onClick={payByCard}
            disabled={busy}
            loading={phase.kind === "card-starting"}
            morph
            done={phase.kind === "paid"}
            className="shrink-0"
          >
            {largeLead ? largeLead.largeLead : c.payByCard}
          </Button>
        ) : null}
      </ActionBar>

    </section>
  );

  const fact = {
    amountMinor: view.totalMinor,
    currency: view.currency,
    subject: view.title,
  };

  /* TRACK A: payment opens on an approved agreement, never before. */
  if (view.agreement?.status !== "approved" && view.agreement?.status !== "paid") {
    return <PaymentGate agreement={view.agreement} />;
  }

  return (
    <>
      {/*
        THE CHECKOUT, ON THIS PAGE. The identical component the stay checkout
        uses, for the identical reason: rent was the other half of the same
        pair of departures, and a second implementation of this would be a
        second thing to get wrong.
      */}
      {phase.kind === "checkout-open" && (
        <PaystackCheckout
          key={phase.reference}
          accessCode={phase.accessCode}
          reference={phase.reference}
          authorizationUrl={phase.authorizationUrl}
          amountMinor={view.totalMinor}
          locale={view.locale}
          confirm={async (reference) => {
            const state = await paymentState(reference);
            return state.ok ? state.data : "pending";
          }}
          onPaid={() => {
            /* No refresh here: see the receipt's onOpenChange below. */
            setPhase({ kind: "paid", reference: phase.reference });
          }}
          onCancelled={() => setPhase({ kind: "idle" })}
          onFailed={(message) => setPhase({ kind: "error", message })}
        />
      )}

      <SuccessSheet
        open={phase.kind === "paid"}
        onOpenChange={() => {
          setPhase({ kind: "idle" });
          router.refresh();
        }}
        variant={paid.variant}
        object={paid.object}
        title={paid.title}
        body={paid.body}
        amount={{ minorUnits: view.totalMinor, currency: view.currency, locale: view.locale }}
        details={[
          { label: s.detail.for, value: view.title },
          ...(phase.kind === "paid" && phase.reference
            ? [{ label: s.detail.reference, value: phase.reference, mono: true }]
            : []),
        ]}
        primary={{ label: c.openThread, href: "/messages" }}
        secondary={{ label: c.backToListing, href: `/listing/${view.listingId}` }}
      />

      <ResultSheet
        open={phase.kind === "applying"}
        onOpenChange={() => setPhase({ kind: "idle" })}
        state="pending"
        verdict={c.confirmingPayment}
        fact={{ ...fact, ...(phase.kind === "applying" && phase.reference ? { reference: phase.reference } : {}) }}
        locale={view.locale}
        consequence={c.chargedConfirming}
        actions={[{ label: c.reload, onClick: () => window.location.reload(), tone: "primary" }]}
      />

      <ResultSheet
        open={busy}
        onOpenChange={() => undefined}
        state="pending"
        blocking
        verdict={
          phase.kind === "opening"
            ? c.preparingPayment
            : phase.kind === "saved-card-charging"
              ? savedCardMoment({ kind: "charging" }, view.totalDisplay).verdict
              : c.openingPaymentPage
        }
        fact={fact}
        locale={view.locale}
        consequence={
          slow
            ? c.slowNothingMoved
            : phase.kind === "saved-card-charging"
              ? savedCardMoment({ kind: "charging" }, view.totalDisplay).consequence
              : c.nothingChargedYet
        }
      />

      <ResultSheet
        open={phase.kind === "saved-card-hosted"}
        onOpenChange={() => setPhase({ kind: "idle" })}
        state={savedCardMoment(hostedPhase, view.totalDisplay).state}
        verdict={savedCardMoment(hostedPhase, view.totalDisplay).verdict}
        fact={fact}
        locale={view.locale}
        consequence={savedCardMoment(hostedPhase, view.totalDisplay).consequence}
        actions={[
          {
            label: c.continueToBank,
            onClick: () => {
              /* The bank's page renders inside the checkout iframe, on this
                 page, under the same reference. */
              if (phase.kind === "saved-card-hosted") {
                setPhase({
                  kind: "checkout-open",
                  accessCode: phase.accessCode,
                  reference: phase.reference,
                  authorizationUrl: phase.authorizationUrl,
                });
              }
            },
            tone: "primary",
          },
          { label: c.payAnotherWay, onClick: () => setPhase({ kind: "idle" }), tone: "quiet" },
        ]}
      />

      <ResultSheet
        open={phase.kind === "stalled"}
        onOpenChange={() => setPhase({ kind: "idle" })}
        state="pending"
        verdict={c.notHeardBack}
        fact={fact}
        locale={view.locale}
        consequence={c.stalledCardRent}
        actions={[
          { label: c.reload, onClick: () => router.refresh(), tone: "primary" },
          { label: c.tryAgain, onClick: () => setPhase({ kind: "idle" }), tone: "quiet" },
        ]}
      />

      <ResultSheet
        open={phase.kind === "error"}
        onOpenChange={() => setPhase({ kind: "idle" })}
        state="failed"
        verdict={c.paymentNotCompleted}
        fact={fact}
        locale={view.locale}
        consequence={failureConsequence(
          phase.kind === "error" ? phase.message : null,
          c.nothingTaken,
          c,
        )}
        actions={
          /* The phone gate's refusal: confirm the number, then come back. */
          phase.kind === "error" && phase.verifyGate
            ? [
                /* The long rental's identity gate (founder, 7 November 2026). */
                { label: VERIFY_ACTION, href: "/verification", tone: "primary" },
                { label: c.getHelp, href: "/help", tone: "quiet" },
              ]
            : phase.kind === "error" && phase.phoneGate && phoneGateAction
            ? [
                { label: phoneGateAction.label, href: phoneGateAction.href, tone: "primary" },
                { label: c.getHelp, href: "/help", tone: "quiet" },
              ]
            : [
                { label: c.tryAgain, onClick: () => setPhase({ kind: "idle" }), tone: "primary" },
                { label: c.getHelp, href: "/help", tone: "quiet" },
              ]
        }
      />

      {panel}
    </>
  );
}
