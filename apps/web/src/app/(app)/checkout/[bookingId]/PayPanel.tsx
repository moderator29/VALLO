"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { usePhoneGateAction } from "@/components/app/PhoneGateLink";
import { startCardCheckout } from "@/lib/bookings/checkout";
import { PaymentGate } from "@/components/app/agreements/PaymentGate";
import { NO_CUSTODY_SENTENCE } from "@/lib/money/copy";
import type { CheckoutView } from "@/lib/bookings/checkout-view";
import { ResultSheet } from "@/components/app/ResultSheet";
import { successCopy } from "@/lib/ui/success-moments";
import { PaystackCheckout, type CheckoutAt } from "@/components/app/payments/PaystackCheckout";
import {
  PaymentStage,
  stageOrigin,
  type StageFace,
  type StageOrigin,
} from "@/components/app/payments/PaymentStage";
import { cardPaymentSteps } from "@/components/app/payments/payment-steps";
import { feedback } from "@/lib/ui/feedback";
import { paymentState } from "@/lib/payments/payment-state";
import { SavedCardPicker } from "@/components/app/payments/SavedCardPicker";
import { preselectedCardId } from "@/components/app/payments/format";
import { savedCardMoment, type SavedCardPhase } from "@/components/app/payments/saved-card-copy";
import type { PaymentMethod } from "@/lib/payments/methods";
import type { ChargeSavedCardOutcome } from "@/lib/payments/charge-saved-card";
import type { ActionResult } from "@/lib/actions/envelope";
import { failureConsequence } from "./payment-copy";
import { Button } from "@/components/ui/Button";
import { ActionBar } from "@/components/ui/ActionBar";
import { Amount } from "@/components/ui/Amount";
import { Panel } from "@/components/ui/Panel";
import { IconPlate } from "@/components/ui/IconPlate";
import { Icon3D } from "@/components/ui/Icon3D";
import { BrandIcon, type BrandIconName } from "@/design-system/icons/BrandIcon";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { CryptoPayOption } from "@/components/app/payments/crypto/CryptoPayOption";
import type { CryptoOffer } from "@/components/app/payments/crypto/offer";

/**
 * The two ways to pay.
 *
 * Card opens a hosted Paystack page; wallet settles inside the platform in one
 * atomic database call. Neither button prices anything: the amount comes from
 * the stored booking row and the server actions read it again for themselves, so
 * nothing a browser could edit reaches the ledger.
 *
 * One idempotency key is minted per method per mount, so the second of two taps
 * on a flaky connection replays the first answer instead of paying twice. Every
 * failure lands as one plain sentence saying what happened and what the guest
 * can do next; no code, no stack, no silence.
 *
 * ---------------------------------------------------------------------------
 * THE THREE PENDING STATES USED TO BE A `loading` PROP ON A BUTTON.
 *
 * `card-starting`, `card-redirecting` and `wallet-paying` rendered as a
 * spinner inside a pill and nothing else. No sentence, no amount, no mark, no
 * live region. Between tapping "Pay 1,250,000 naira from my wallet" and
 * anything happening, a person moving the largest sum on this platform saw a
 * disc rotating inside the button they had just pressed, on a button that was
 * simultaneously disabled, which is how a loading state and a dead control end
 * up looking identical.
 *
 * All three are one `ResultSheet state="pending"` now, over the page, carrying
 * the three things a pending state owes somebody: a mark, the amount, and the
 * consequence. The wallet already did this properly four times over and
 * checkout did it nowhere.
 *
 * ---------------------------------------------------------------------------
 * AND NEITHER PATH HAD A TIMEOUT.
 *
 * If `startCardCheckout` hung, `busy` stayed true forever, BOTH pay buttons
 * stayed disabled with no explanation, and there was no cancel. On a Lagos
 * network that is not an edge case. There is a soft message at ten seconds
 * and a terminal state at twenty-five, and both say whether the money moved.
 *
 * THE SECOND HALF OF THAT PARAGRAPH IS NOW OBSOLETE AND HAS BEEN REMOVED
 * RATHER THAN LEFT TO MISLEAD. It described `window.location.assign` being
 * slow or blocked, and `card-redirecting` spinning indefinitely behind it.
 * Neither exists: there is no navigation, and `checkout-open` hands the wait
 * to `PaystackCheckout`, which has its own clock and its own honest ending.
 * The two clocks here now cover only the server round trip, which is the only
 * thing left for them to cover.
 */

/** A key per submit. crypto.randomUUID exists in every browser this ships to. */
function newKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `k-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

/** When the wait stops being normal, and when it stops being a wait. */
const SLOW_MS = 10_000;
const GIVE_UP_MS = 25_000;

/**
 * A CHECKOUT THAT OPENS ON THIS PAGE, NOT ON SOMEBODY ELSE'S.
 *
 * `card-redirecting` is gone and `checkout-open` has taken its place. The old
 * phase existed to cover the gap between the tap and a full-page navigation to
 * checkout.paystack.com; there is no navigation any more, so what the phase
 * carries now is the handle the in-app checkout resumes with. Both the fresh
 * card path and the saved-card 3-D Secure path arrive at the same phase with
 * the same shape, because they are the same transaction resumed the same way,
 * and the 3DS one keeps the caller's original reference.
 */
type Phase =
  | { kind: "idle" }
  | { kind: "saved-card-charging" }
  | { kind: "saved-card-hosted"; authorizationUrl: string; accessCode: string; reference: string }
  | { kind: "card-starting" }
  | { kind: "checkout-open"; accessCode: string; reference: string; authorizationUrl: string }
  /* Settled against this booking, with the reference the receipt shows. */
  | { kind: "paid"; reference: string }
  /* Charged on the saved card and not yet applied to this booking: never
     "paid", never "not charged" (docs/SUCCESS_MOMENTS.md). */
  | { kind: "applying"; reference: string }
  | { kind: "stalled"; method: "card" }
  | { kind: "error"; message: string; phoneGate?: boolean };

/**
 * One way to pay.
 *
 * THE ROOM IS THE POINT. These rows were `p-4 gap-3.5` with 13px metadata,
 * which made the screen where somebody pays 1.2m naira one of the two most
 * tightly packed surfaces in the product, the other being the screen where an
 * operator decides whose money moves. Every value here is now a named interval
 * on the scale rather than a number chosen at this call site, and the tier they
 * land on is the one the rest of the product uses.
 */
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
    <Panel as="li" variant="card" className="isolate flex-row items-start gap-group">
      {/* The founder's 3D card with its padlock (30 September) for the card
          options; display only, nothing here touches the charge. */}
      {icon === "card-lock" ? (
        <span className="grid size-14 shrink-0 place-items-center" aria-hidden="true" data-art="card-secure">
          <Icon3D name="card-secure" size={56} />
        </span>
      ) : (
        <IconPlate size="lg">
          <span className="block h-8 w-8">
            <BrandIcon name={icon} fill tile={false} />
          </span>
        </IconPlate>
      )}
      <div className="min-w-0 flex-1">
        <p className="nf-body font-semibold text-[var(--nf-content-primary)]">{title}</p>
        <p className="nf-body-sm mt-inline-tight leading-relaxed text-[var(--nf-content-secondary)]">
          {body}
        </p>
        {note && (
          <p className="nf-body-sm mt-inline leading-relaxed text-[var(--nf-content-muted)]">
            {note}
          </p>
        )}
        {action && <div className="mt-row">{action}</div>}
      </div>
    </Panel>
  );
}

export function PayPanel({
  view,
  savedCards = [],
  chargeSavedCard,
  plansAction,
  crypto = null,
}: {
  /**
   * Pay with crypto (lib/crypto), decided on the server by the page. Null
   * whenever crypto is off for the platform, so nothing about it renders.
   */
  crypto?: CryptoOffer | null;
  view: CheckoutView;
  /** Where "done" sends somebody, in the dictionary's words (V-76 review). */
  plansAction: { label: string; href: string };
  /**
   * The caller's reusable cards, read on the server by `listPaymentMethods`.
   * Empty by default, so a page that does not pass them draws no saved-card
   * option rather than an empty group.
   */
  savedCards?: PaymentMethod[];
  /**
   * THE ONE THING THIS SCREEN CANNOT DO FOR ITSELF, AND IT IS A PROP FOR A
   * REASON.
   *
   * `lib/payments/charge-saved-card.ts` is deliberately NOT a server action:
   * "a function that charges a chosen amount against a chosen reference must
   * never be one". It is imported by the payment action that already decided
   * what is owed and under which reference, and the action that owes this
   * booking is `lib/bookings/checkout.ts`, where the payable guard, the
   * idempotency wrapper and the booking reference already live and are all
   * private to that module.
   *
   * So the button cannot be wired from here without re-implementing the money
   * orchestration, which is the one thing never worth duplicating. When that
   * module exports, say, `payWithSavedCard({ bookingId, methodId,
   * idempotencyKey })`, the page passes it here and every state below is
   * already built and tested. Until it does, no saved-card control renders at
   * all: a pay button that cannot pay is worse than no button.
   */
  chargeSavedCard?: (methodId: string) => Promise<ActionResult<ChargeSavedCardOutcome>>;
}) {
  /* From the route's CopyScope (W13): no client dictionary read. */
  const c = useScopedCopy("checkout");
  const s = useScopedCopy("success");
  const paid = successCopy(s, "stayPaidRecorded");
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const phoneGateAction = usePhoneGateAction();
  const [slow, setSlow] = useState(false);
  /* Where the in-page checkout is (PaystackCheckout, staged), and the control
     the pay stage grows out of. */
  const [checkoutAt, setCheckoutAt] = useState<CheckoutAt>("idle");
  const [origin, setOrigin] = useState<StageOrigin | null>(null);
  /* Inline arrows rather than `useMemo(newKey, [])`. Passing the function by
     reference works today and the React compiler refuses to see through it, so
     it cannot keep the value stable when it takes over memoisation - which is
     the one thing these two exist for. They key the two result panels, so a key
     that changed between renders would remount a panel mid-payment. */
  const cardKey = useMemo(() => newKey(), []);
  const timers = useRef<number[]>([]);

  /* The saved card offered first: the default when it can be charged. Null
     means nothing chargeable, so the whole option stays off the screen. */
  const [chosenCard, setChosenCard] = useState<string | null>(() =>
    preselectedCardId(savedCards),
  );
  const savedCardsOffered = Boolean(chargeSavedCard) && chosenCard !== null;
  /* The sheet below reads the moment three times (state, verdict, consequence),
     so the phase it reads is named once rather than reconstructed per call. */
  const hostedPhase: SavedCardPhase =
    phase.kind === "saved-card-hosted"
      ? { kind: "needs_hosted", authorizationUrl: phase.authorizationUrl }
      : { kind: "needs_hosted", authorizationUrl: "" };

  const busy =
    phase.kind === "saved-card-charging" ||
    phase.kind === "card-starting" ||
    phase.kind === "checkout-open";

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

  /* Two clocks per attempt: one that admits the wait is long, one that stops
     pretending it is still a wait. Both are cleared the moment the server
     answers, so a fast payment never sees either. */
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

  /**
   * Charging the saved card, and the 3DS rule in one place.
   *
   * `chargeSavedCard` answers with `charged` or with `needs_hosted_checkout`,
   * and the second is NOT a failure: the bank has asked to authenticate, the
   * reference is the same one, and the only honest move is to say so and go
   * there once. This never retries the saved card, because a loop of declined
   * charges is how a card gets blocked and a person gets charged twice.
   */
  const payBySavedCard = async (event?: React.MouseEvent<HTMLElement>) => {
    if (!chargeSavedCard || !chosenCard) return;
    setOrigin(stageOrigin(event?.currentTarget));
    startClocks("card");
    setPhase({ kind: "saved-card-charging" });
    const result = await chargeSavedCard(chosenCard);
    clearTimers();

    if (!result.ok) {
      setPhase({ kind: "error", message: result.error, phoneGate: result.gate === "phone" });
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
    /* Charged. `settled` is the server's word that the charge was applied to
       THIS booking; without it the charge is still being applied and the
       success sheet waits. */
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

  const payByCard = async (event?: React.MouseEvent<HTMLElement>) => {
    setOrigin(stageOrigin(event?.currentTarget));
    setCheckoutAt("idle");
    startClocks("card");
    setPhase({ kind: "card-starting" });
    const result = await startCardCheckout({
      bookingId: view.bookingId,
      idempotencyKey: cardKey,
    });
    if (result.ok && result.data) {
      /* The clocks stop here. They covered the gap between the tap and a
         navigation; the checkout has its own, and leaving these running would
         declare the payment stalled while the person was typing their PIN. */
      clearTimers();
      /* The server ACCEPTED the commit: the medium beat (CRAFT_DOCTRINE 6).
         Not on the tap, which only asked; not on the wait, which is passive. */
      feedback("confirm");
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
      message: result.ok
        ? c.pageNotOpened
        : result.error,
      phoneGate: !result.ok && result.gate === "phone",
    });
  };

  const panel = (
    <section aria-labelledby="nf-checkout-pay">
      <h2 id="nf-checkout-pay" className="nf-h3">
        {c.howToPay}
      </h2>
      <ul className="mt-block grid gap-row">
        {/*
          PAY WITH A SAVED CARD, ABOVE THE HOSTED REDIRECT.

          It is first because it is the shortest path for somebody who has
          already trusted us with a card: one tap against three fields and a
          round trip to another domain. It renders only when there is a card
          that can actually be charged AND a way to charge it; see the
          `chargeSavedCard` prop for why the second half is not this file's to
          supply. Nothing about a saved card ever appears in a third-party
          lane, which does not exist yet and is forbidden them when it does.
        */}
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
                  /* Motion 7: the arc while the server is asked, the tick
                     only once the settlement says paid. Both states are this
                     panel's own phases, read from the server, never a timer. */
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
            title={c.cardTitle}
            body={c.cardBody}
            action={
              /*
                THE AMOUNT IS NOT IN THE LABEL, AND IT WAS OVERFLOWING.

                `.nf-btn` is `white-space: nowrap` with no `overflow: hidden`,
                and the label was "Pay <amount> from my wallet" inside a full
                width button inside a row that already spends 48px on an object
                and a gap beside it. Reconstructed at 390px and measured: "Pay
                ₦95,000.00 by card" fits with one pixel to spare, "Pay
                ₦12,500,000.00 by card" overflows, and "Pay ₦1,250,000.00 from
                my wallet" overflows by 24 pixels, so a person could not read
                what they were about to pay on the largest amounts this
                platform handles.

                The total is already set at up to 60px directly above under
                "Total to pay", and it is repeated on the pinned bar and again
                on the confirmation. Three statements of one figure is enough;
                a fourth that clips is not a statement.
              */
              /* With a saved card offered, that card is the chosen way and
                 this one is the alternative, so it is not a second lit
                 primary beside it (Round 3 sweep, C1). */
              <Button
                variant={savedCardsOffered ? "secondary" : "primary"}
                full
                onClick={payByCard}
                disabled={busy}
                loading={phase.kind === "card-starting"}
                morph
                done={phase.kind === "paid"}
              >
                {c.payByCard}
              </Button>
            }
          />
        ) : (
          <Option
            icon="card-lock"
            title={c.cardTitle}
            /* "Card payment switches on the moment payment keys land" was
               infrastructure jargon, printed to somebody trying to pay. This
               says what is true, what it costs them, and what to do instead. */
            body={c.cardUnavailable}
            /* "…or try again SHORTLY" is gone, and it was the last time this
               product named a schedule in a refusal on the money path. It is a
               milder relative of the banned "coming soon": a promise about a
               time nobody here can keep, told to somebody holding a card. The
               sentence loses the word and keeps the instruction, which is the
               only part the reader could act on anyway. */
            note={c.cardUnavailableStayNote}
          />
        )}
        {/* Pay with crypto: the same charge, the same split legs, settled in
            naira by a licensed provider. Absent unless the server opened it. */}
        {crypto && (
          <CryptoPayOption offer={crypto} bookingId={view.bookingId} totalMinor={view.totalMinor} locale={view.locale} />
        )}
      </ul>
      {/* Where the money goes, said before the tap. Vallo never holds it. The
          rail's standing sentence is not repeated here: the page mounts this
          panel straight under TransactionCheckout, whose "What stands behind
          it" row already says it word for word (Round 3 sweep, C1). */}
      <p className="nf-caption mt-block leading-relaxed text-[var(--nf-content-muted)]" data-testid="checkout-no-custody">
        {NO_CUSTODY_SENTENCE}
      </p>
      {/* `UiIcon` at 16 rather than a 16px `BrandIcon`. `docs/ICON_SYSTEM.md`
          says below 24 the plinth in the brand artwork collapses into a
          coloured square, and this row is otherwise all stroked glyphs, so the
          two tiers were sharing a line as well. */}
      {/*
        THE DECISION IS PINNED, AND THE PRIMITIVE THAT DOES IT WAS BUILT FOR
        THIS SCREEN AND NEVER USED ON IT.

        `components/ui/ActionBar.tsx` names checkout in its own docstring as
        "the screen that had no pinned bar at all", and it was imported by
        exactly one file on the whole platform, which was not this one. The pay
        buttons sat below a summary card, below a step bar, below a countdown,
        and scrolled out of view: on a 390px screen the money decision was
        somewhere above the fold and somewhere below it depending on where a
        thumb had last stopped.

        BOTH METHODS STAY IN THE BODY. Only the chosen one is pinned, with the
        total beside it, so the bar answers "how much, and do it" and the cards
        above keep answering "which way". Pinning both would be two primary
        actions on the bottom edge, which is how somebody taps the wrong one.
      */}
      <p className="nf-caption mt-block flex items-start gap-inline leading-relaxed text-[var(--nf-content-muted)]">
        {/* Advice, so a neutral glyph: the shield means an earned check (A9). */}
        <UiIcon name="info" size="xs" className="mt-3xs shrink-0" />
        <span>{c.onPlatformStay}</span>
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
          <span className="nf-caption text-[var(--nf-content-muted)]">{c.totalToPay}</span>
          <span className="min-w-0">
            <Amount
              minorUnits={view.totalMinor}
              locale={view.locale}
              currency={view.currency}
              showFraction
              className="text-[length:var(--nf-text-body-lg)] font-bold leading-none tracking-[-0.02em] text-[var(--nf-content-primary)]"
              secondaryClassName="text-[length:max(0.62em,0.75rem)] font-semibold text-[var(--nf-content-muted)]"
            />
          </span>
        </p>
        {/* The bar pins the chosen way, as the note above says: the saved
            card when one is offered, otherwise the card page. It pinned "Pay
            by card" even while the saved card was the chosen way. */}
        {savedCardsOffered ? (
          <Button
            variant="primary"
            onClick={payBySavedCard}
            disabled={busy || chosenCard === null}
            loading={phase.kind === "saved-card-charging"}
            morph
            done={phase.kind === "paid"}
            className="shrink-0"
          >
            {c.payWithThisCard}
          </Button>
        ) : view.cardAvailable ? (
          <Button
            variant="primary"
            onClick={payByCard}
            disabled={busy}
            loading={phase.kind === "card-starting"}
            morph
            done={phase.kind === "paid"}
            className="shrink-0"
          >
            {c.payByCard}
          </Button>
        ) : null}
      </ActionBar>

    </section>
  );

  /* The fact every one of these sheets carries. Money on its own is not a
     receipt: the property is what makes it one. */
  const fact = {
    amountMinor: view.totalMinor,
    currency: view.currency,
    subject: view.title,
  };

  /*
   * THE STAGE'S FACE, FROM THE PHASE THE SERVER PUT US IN. `paid` is written
   * in exactly one place below, from `phase.kind === "paid"`, which only the
   * settlement (`settled`) or our own transaction record (`paymentState`)
   * ever sets. The steps tick from real phases too (cardPaymentSteps).
   */
  const steps = (at: "opening" | "settling") =>
    cardPaymentSteps(at, {
      opening: c.openingPaymentPage,
      confirming: c.confirmingPayment,
      received: c.paymentReceived,
    });
  const opening: StageFace = {
    at: "committing",
    verdict: c.openingPaymentPage,
    consequence: slow ? c.slowNothingMoved : c.nothingChargedYet,
    steps: steps("opening"),
    note: c.recordedOnce,
  };
  const face: StageFace | null =
    phase.kind === "saved-card-charging"
      ? {
          at: "committing",
          verdict: savedCardMoment({ kind: "charging" }, view.totalDisplay).verdict,
          consequence: slow
            ? c.slowNothingMoved
            : savedCardMoment({ kind: "charging" }, view.totalDisplay).consequence,
          note: c.recordedOnce,
        }
      : phase.kind === "card-starting"
        ? opening
        : phase.kind === "checkout-open"
          ? checkoutAt === "settling"
            ? {
                at: "processing",
                verdict: c.confirmingPayment,
                consequence: c.returnChecking,
                steps: steps("settling"),
                note: c.recordedOnce,
              }
            : /* While the bank's window is up, or it could not open (which
                 PaystackCheckout says itself), the stage steps aside. */
              checkoutAt === "open" || checkoutAt === "unavailable"
              ? null
              : opening
          : phase.kind === "paid"
            ? {
                at: "paid",
                settled: true,
                moment: {
                  variant: paid.variant,
                  object: paid.object,
                  title: paid.title,
                  body: paid.body,
                  details: [
                    { label: s.detail.for, value: view.title },
                    ...(phase.reference ? [{ label: s.detail.reference, value: phase.reference, mono: true }] : []),
                  ],
                  primary: { label: plansAction.label, href: plansAction.href },
                  secondary: { label: c.backToStay, href: view.stayHref },
                },
              }
            : phase.kind === "applying"
              ? {
                  at: "unknown",
                  verdict: c.confirmingPayment,
                  consequence: c.chargedConfirming,
                  actions: [{ label: plansAction.label, href: plansAction.href, tone: "primary" }],
                }
              : phase.kind === "stalled"
                ? {
                    at: "unknown",
                    verdict: c.notHeardBack,
                    consequence: c.stalledCardStay,
                    actions: [
                      { label: plansAction.label, href: plansAction.href, tone: "primary" },
                      { label: c.tryAgain, onClick: () => setPhase({ kind: "idle" }), tone: "quiet" },
                    ],
                  }
                : phase.kind === "error"
                  ? {
                      at: "failed",
                      verdict: c.paymentNotCompleted,
                      /* THE SERVER'S STRING NO LONGER REACHES THE READER
                         UNFILTERED: `payment-copy` rewrites the jargon, drops
                         anything that is not prose a person wrote, and always
                         leaves the money sentence standing. */
                      consequence: failureConsequence(phase.message, c.nothingTaken, c),
                      /* The phone gate's refusal says the one step that works:
                         confirm the number, then come straight back here. */
                      actions:
                        phase.phoneGate && phoneGateAction
                          ? [
                              { label: phoneGateAction.label, href: phoneGateAction.href, tone: "primary" },
                              { label: c.getHelp, href: "/help", tone: "quiet" },
                            ]
                          : [
                              { label: c.tryAgain, onClick: () => setPhase({ kind: "idle" }), tone: "primary" },
                              { label: c.getHelp, href: "/help", tone: "quiet" },
                            ],
                    }
                  : null;
  const stageAmount = { minorUnits: view.totalMinor, currency: view.currency, locale: view.locale };
  const closeStage = () => {
    const wasPaid = phase.kind === "paid";
    setPhase({ kind: "idle" });
    /* A settled payment refreshes when its receipt closes: refreshing at the
       moment it settled would re-render the page down its paid branch and
       take the receipt away as it arrived. */
    if (wasPaid) router.refresh();
  };

  /* TRACK A: no button the database would refuse. Payment opens on an approved agreement. */
  if (view.agreement?.status !== "approved") return <PaymentGate agreement={view.agreement} kind="stay" />;

  return (
    <>
      {/*
        THE CHECKOUT, ON THIS PAGE.

        One component for both card paths. It draws nothing while Paystack's
        iframe is up, because that iframe is fixed and full viewport and a
        sheet of ours behind it would be a second dialog a screen reader
        announces over the one the person is using. What is underneath is our
        page, and the address bar has never stopped being ours.

        `paymentState` is what settles it: our own `transactions` row for this
        reference, polled on a backoff, never a call to Paystack from a
        browser. `onSuccess` from the popup only starts that asking.
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
          /* Cancelled is not a failure and it is not a stall. The reference
             stays open, so coming back resumes rather than double charges. */
          onCancelled={() => setPhase({ kind: "idle" })}
          onFailed={(message) => setPhase({ kind: "error", message })}
          staged
          onPhase={setCheckoutAt}
        />
      )}

      {/*
        ONE CARD FROM THE TAP TO THE ANSWER (PaymentStage, round 5).

        This was five sheets: a blocking pending sheet here, the checkout's
        own pending sheets stacked on top of it while the bank window loaded,
        a success card, and separate sheets for "applying", "not heard back"
        and the failure. The stage is one card whose face changes, so the
        amount a person just paid never leaves the place they first saw it.
        It is blocking while the outcome is unknown (a person who dismisses a
        wait and taps Pay again is trying to pay twice) and only then.
      */}
      <PaymentStage face={face} amount={stageAmount} origin={origin} onClose={closeStage} />
      {/*
        THE BANK WANTS TO CHECK, AND THIS IS THE ONE STATE THAT MUST NOT READ
        AS A FAILURE.

        `review` rather than `failed`: cyan, with a mark that differs from
        pending's, so it is told apart by shape and word rather than by hue. It
        says nothing has been charged, because nothing has, and the only action
        goes to the bank's own page under the SAME reference. There is no
        "try again with the saved card" here by design.
      */}
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
              /* The bank's own authentication page renders inside the checkout
                 iframe, on this page, under the same reference. Every 3-D
                 Secure challenge on this platform used to be served by
                 throwing the person at a hosted page. */
              if (phase.kind === "saved-card-hosted") {
                setOrigin(null);
                setCheckoutAt("idle");
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

      {panel}
    </>
  );
}

