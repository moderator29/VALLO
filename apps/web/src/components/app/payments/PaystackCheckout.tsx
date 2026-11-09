"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@vallo/i18n/core";
import { useScopedCopy } from "@/lib/i18n/copy-scope";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { ResultSheet } from "@/components/app/ResultSheet";
import { PaymentSteps, cardPaymentSteps } from "./PaymentSteps";
import { clearInflight, noteInflight } from "@/lib/offline/inflight";
import { releaseCardAttempt } from "@/lib/payments/attempt-actions";

/**
 * Tell our server the payer closed the window. The server asks Paystack
 * before closing anything (lib/payments/attempt-actions.ts), so this is a
 * hint, never a verdict. Fire and forget: nothing on this page waits on it,
 * and if it fails the hourly sweep closes the attempt instead.
 */
function releaseAttempt(reference: string): void {
  void releaseCardAttempt(reference).catch(() => undefined);
}

/**
 * THE CHECKOUT THAT DOES NOT LEAVE.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS REPLACES.
 *
 * Eight `window.location.assign(authorizationUrl)` calls. The tab that was
 * Vallo became the tab that was Paystack: their address bar, their page, and
 * our React tree destroyed, so a person who abandoned the payment and pressed
 * back arrived at a remounted panel with no memory of the attempt. On the
 * native shell it was worse still, because the in-app browser tab shows the
 * third party's URL in a chrome that is not ours.
 *
 * The whole server half of the fix was already built and thrown away on every
 * transaction this platform has ever taken. `initializeTransaction` returns
 * Paystack's `access_code` beside the authorisation URL, has done since the
 * file was written, and until this week nothing read it.
 * `PaystackPop.resumeTransaction(accessCode, callbacks)` resumes that exact
 * transaction inside an iframe on THIS page. No navigation, no new window, no
 * second address bar.
 *
 * ---------------------------------------------------------------------------
 * WHAT WAS READ RATHER THAN ASSUMED, AND WHAT WAS NOT.
 *
 * Paystack's own hosts were not reachable from the environment this was
 * written in, so none of this was run against a live test card. What follows was read out
 * of `@paystack/inline-js` 2.25.0 itself, the published bundle, which is a
 * primary source:
 *
 *  - `resumeTransaction(accessCode, cbs)` calls `newTransaction({accessCode,
 *    ...cbs})`, and the parameter validator's FIRST statement is
 *    `if ("accessCode" in n) return { accessCode: n.accessCode }`. It returns
 *    before the required-parameter loop runs, so no public key is required or
 *    even looked at on this path. The one `publicKey` in the bundle is
 *    Paystack's own RSA key for encrypting card data, not a merchant key.
 *  - The iframe's src is `https://checkout.paystack.com/popup?precheckout=true`
 *    and that is the only checkout origin in the production config. It is
 *    appended to `document.body`, fixed, full-viewport, with
 *    `allow="payment; clipboard-read; clipboard-write"`.
 *  - There is no `window.open` anywhere in the bundle. Not one occurrence.
 *  - On the resume path the bundle makes NO network call from our page:
 *    `requestInline()`, the one `fetch` to `api.paystack.co`, is reached only
 *    from `checkout()` and `paymentRequest()`. That is why `connect-src` in
 *    `lib/security/csp.ts` can stay `'self'` plus Supabase.
 *
 * WHAT IS STILL INFERENCE: that the bank's 3-D Secure page renders inside that
 * same iframe rather than opening something. The absence of `window.open` in
 * the bundle makes it very hard for it to do anything else, but the ACS page
 * is served by the bank into Paystack's checkout document, which this side
 * cannot see. A real 3-D Secure test card settles it; the test is written out
 * in `docs/archive/BUILD_07_LEDGER.md`.
 *
 * ---------------------------------------------------------------------------
 * THE RESOLUTION LOOP: THREE SIGNALS, NONE OF THEM TRUSTED ALONE.
 *
 * 1. `onSuccess` from the popup. Fastest, and treated as a HINT. It is a
 *    message from an iframe; it is never what makes money real.
 * 2. The webhook, unchanged, which is what actually posts the ledger row and
 *    wins every race by construction.
 * 3. A bounded poll of OUR OWN server, every two seconds for ninety seconds,
 *    through the `confirm` prop. This covers the case `onSuccess` never fires:
 *    the iframe was killed, iOS backgrounded the WebView, the network dropped
 *    between Pusher and us.
 *
 * ---------------------------------------------------------------------------
 * AND THE THING THIS COMPONENT WILL NOT DO.
 *
 * IT NEVER NAVIGATES ANYWHERE BY ITSELF. When the library cannot load at all,
 * the honest answer is not to quietly fall back to the hosted page, because
 * that is the exact behaviour the founder asked us to stop. It says what
 * happened, names the destination, and offers the hosted page as a control the
 * person presses on purpose. A deliberate choice to leave is not us throwing
 * somebody out.
 */

/** Paystack's callbacks, as the 2.25.0 bundle actually declares them. */
type PopupCallbacks = {
  onLoad?: (payload: { id?: string | number; accessCode?: string }) => void;
  onSuccess?: (payload: { reference?: string; status?: string; message?: string }) => void;
  onCancel?: () => void;
  onError?: (payload: { message?: string }) => void;
};

type PaystackPopInstance = {
  resumeTransaction: (accessCode: string, callbacks: PopupCallbacks) => unknown;
  cancelTransaction?: (id: unknown) => void;
};

/** What our own server says about the reference, which is the only truth here. */
export type ConfirmOutcome = "paid" | "pending" | "failed";

export type PaystackCheckoutProps = {
  /** Paystack's handle for the transaction our server already initialised. */
  accessCode: string;
  /** Our reference. Shown to the person, and the key `confirm` reads by. */
  reference: string;
  /**
   * The hosted page's address, which the server still returns. Never used:
   * the payment never leaves the app (founder, 9 November 2026), so it is not
   * navigated to and not offered. Accepted so callers need no change.
   */
  authorizationUrl?: string;
  /** Integer kobo, for the pending and settled sheets. */
  amountMinor?: number;
  locale?: Locale;
  /**
   * Ask OUR OWN server whether the reference has settled. Polled, so it must
   * be cheap and it must be idempotent. Omit it and `onSuccess` is taken at
   * face value, which is only honest where the caller settles some other way.
   */
  confirm?: (reference: string) => Promise<ConfirmOutcome>;
  /** The money is real. The caller refreshes and moves on. */
  onPaid: (reference: string) => void;
  /** The person closed the window. Nothing was charged; the reference is open. */
  onCancelled: () => void;
  /** It failed, or we stopped being able to tell. The sentence is the truth. */
  onFailed: (message: string) => void;
  /**
   * The caller draws the wait itself, in its own pay stage (PaymentStage), so
   * the card a person tapped into is the card that answers them. With this
   * set, `opening` and `settling` draw nothing here and are reported through
   * `onPhase` instead; `unavailable` is still drawn here, because it offers a
   * choice only this component can make.
   */
  staged?: boolean;
  /** Where the checkout is, every time that changes. */
  onPhase?: (at: CheckoutAt) => void;
};

/** The checkout's own phases, as `onPhase` reports them. */
export type CheckoutAt = "idle" | "opening" | "open" | "settling" | "unavailable";

/**
 * The poll, and why it backs off rather than ticking.
 *
 * Ninety seconds is the horizon, which is long enough for a Nigerian bank
 * transfer notification to make the round trip. A flat two-second tick gets
 * there in forty-five requests, and `lib/security/money-limits.ts` would then
 * need an allowance of a hundred and fifty, which its own test refuses and is
 * right to refuse: an allowance sized to fit any loop is not a limit.
 *
 * Backing off reaches the same horizon in about twelve. It is also simply the
 * better shape: the webhook usually lands inside two seconds, so the early
 * checks are where the answer is and the later ones are only waiting.
 */
const POLL_STEPS_MS = [2_000, 2_000, 3_000, 4_000, 6_000, 8_000, 10_000] as const;
const POLL_FOR_MS = 90_000;

/** The wait before attempt `n`, easing out and then holding at ten seconds. */
function pollDelay(attempt: number): number {
  return POLL_STEPS_MS[Math.min(attempt, POLL_STEPS_MS.length - 1)] ?? 10_000;
}

/**
 * How long we wait for the popup to say anything at all before admitting it
 * has not opened. The library is a dynamic import off our own origin, so this
 * covers a cold chunk on a slow connection and nothing more.
 */
const OPEN_TIMEOUT_MS = 20_000;

type Phase =
  | { kind: "idle" }
  | { kind: "opening" }
  | { kind: "open" }
  | { kind: "settling" }
  | { kind: "unavailable"; message: string; offline?: true };

/**
 * MOUNTING IS OPENING. There is no `open` prop and that is deliberate: one
 * mount is one transaction, so the caller renders this only while a
 * transaction is live and unmounts it when it is done. A boolean would have
 * meant resetting phase state from inside an effect on every flip, which is
 * the cascading-render pattern React now warns about, and, worse, it would
 * have let one mounted component serve two different access codes in
 * sequence with the timers of the first still running.
 */
export function PaystackCheckout({
  accessCode,
  reference,
  amountMinor,
  locale,
  confirm,
  onPaid,
  onCancelled,
  onFailed,
  staged = false,
  onPhase,
}: PaystackCheckoutProps) {
  const [phase, setPhase] = useState<Phase>(() =>
    accessCode.trim().length > 0
      ? { kind: "opening" }
      : { kind: "unavailable", message: "This payment could not be opened here." },
  );

  /* Callbacks reach us from an iframe long after the render that created
     them, so they are read through a ref rather than closed over: a stale
     `onPaid` here would settle a payment into a panel that has moved on. */
  const handlers = useRef({ onPaid, onCancelled, onFailed, confirm, onPhase });
  handlers.current = { onPaid, onCancelled, onFailed, confirm, onPhase };
  useEffect(() => {
    handlers.current.onPhase?.(phase.kind);
  }, [phase.kind]);
  /* V-40: the figure for the in-flight note, read when the checkout opens. */
  const amountRef = useRef(amountMinor);
  amountRef.current = amountMinor;

  /* `onLoad` fired at least once. This is the whole difference between two
     sentences that must not be swapped: before it, nothing has been charged
     and we can say so; after it, a card may have been presented and "nothing
     was charged" would be a lie. */
  const loaded = useRef(false);
  const finished = useRef(false);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  /**
   * Ask our own server, on a bounded clock, until it answers or the clock
   * runs out. Never asks Paystack: the browser has no business holding a
   * processor credential and `connect-src` would refuse it anyway.
   */
  const settle = useCallback(
    async (why: "success" | "closed") => {
      if (finished.current) return;
      setPhase({ kind: "settling" });

      const ask = handlers.current.confirm;
      if (!ask) {
        /* No confirmer: the caller settles some other way, so the hint is all
           there is and the caller is told exactly that. */
        finished.current = true;
        handlers.current.onPaid(reference);
        return;
      }

      const until = Date.now() + POLL_FOR_MS;
      let attempt = 0;
      for (;;) {
        if (finished.current) return;
        let outcome: ConfirmOutcome = "pending";
        try {
          outcome = await ask(reference);
        } catch {
          outcome = "pending";
        }
        if (finished.current) return;
        if (outcome === "paid") {
          finished.current = true;
          clearInflight(reference);
          handlers.current.onPaid(reference);
          return;
        }
        if (outcome === "failed") {
          finished.current = true;
          clearInflight(reference);
          handlers.current.onFailed(
            "That payment did not go through, and nothing was taken. You can try again.",
          );
          return;
        }
        if (Date.now() >= until) break;
        const wait = pollDelay(attempt);
        attempt += 1;
        await new Promise((resolve) => window.setTimeout(resolve, wait));
      }

      if (finished.current) return;
      finished.current = true;
      /* Ninety seconds and our own database still has nothing. This is the
         sentence that must not lie in either direction: we do not know, the
         webhook may still land it, and the person must not pay twice on the
         strength of a screen that guessed. */
      handlers.current.onFailed(
        why === "success"
          ? `The payment window said it was done, and it has not reached us yet. Do not pay again. Your reference is ${reference} and this page updates on its own if it lands.`
          : `We could not confirm that payment. Do not pay again until you have checked: your reference is ${reference}.`,
      );
    },
    [reference],
  );

  useEffect(() => {
    if (accessCode.trim().length === 0) return;

    let cancelled = false;

    /* V-40. Money is never started offline, and a payment that is started is
       noted by reference BEFORE a card can be presented, so a popup that dies,
       an app that is killed or a network that drops between charge and
       confirm is resolved later (`InflightResolver`) rather than guessed at.
       The note is cleared on every ending that is certain. */
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      /* Deferred a tick: the sentence is state, not a synchronous effect write. */
      void Promise.resolve().then(() => {
        if (!cancelled) setPhase({ kind: "unavailable", message: "", offline: true });
      });
      return () => {
        cancelled = true;
      };
    }
    noteInflight(reference, amountRef.current ?? null);

    /* If nothing has been heard by the timeout, the popup did not open. Say
       so rather than spinning: a disc rotating forever is how a loading state
       and a dead control end up looking identical. */
    timers.current.push(
      window.setTimeout(() => {
        if (cancelled || loaded.current || finished.current) return;
        clearInflight(reference);
        setPhase({
          kind: "unavailable",
          message: "The payment window did not open. Nothing has been charged.",
        });
      }, OPEN_TIMEOUT_MS),
    );

    void (async () => {
      let Pop: new () => PaystackPopInstance;
      try {
        /* Dynamic, so the library is a chunk off our own origin fetched at the
           moment somebody decides to pay, not weight on every page. */
        const mod = (await import("@paystack/inline-js")) as unknown as {
          default: new () => PaystackPopInstance;
        };
        Pop = mod.default;
      } catch {
        if (cancelled) return;
        clearTimers();
        clearInflight(reference);
        setPhase({
          kind: "unavailable",
          message: "The payment window could not be loaded. Nothing has been charged.",
        });
        return;
      }
      if (cancelled) return;

      try {
        const popup = new Pop();
        popup.resumeTransaction(accessCode, {
          onLoad: () => {
            if (cancelled) return;
            loaded.current = true;
            clearTimers();
            setPhase({ kind: "open" });
          },
          onSuccess: () => {
            if (cancelled) return;
            clearTimers();
            void settle("success");
          },
          onCancel: () => {
            if (cancelled || finished.current) return;
            clearTimers();
            finished.current = true;
            /* Closed without paying. The server confirms with Paystack and
               closes the attempt, so a retry opens a fresh checkout and the
               agreement is no longer held as "payment in flight". */
            clearInflight(reference);
            releaseAttempt(reference);
            setPhase({ kind: "idle" });
            handlers.current.onCancelled();
          },
          onError: (payload) => {
            if (cancelled || finished.current) return;
            clearTimers();
            /* THE ONE MESSAGE THAT MUST NOT LIE. Before `onLoad` nothing was
               presented and "nothing was charged" is true. After it, a card
               may have been entered, so we go and ask instead of promising. */
            if (!loaded.current) {
              finished.current = true;
              clearInflight(reference);
              /* The window never started, so this checkout may be dead (an
                 expired access code). Closing it on Paystack's word means
                 the next tap opens a new one instead of reusing it. */
              releaseAttempt(reference);
              const said = (payload?.message ?? "").trim();
              setPhase({ kind: "idle" });
              handlers.current.onFailed(
                said.length > 0
                  ? `The payment window could not start, so nothing was charged. It said: ${said}`
                  : "The payment window could not start, so nothing was charged.",
              );
              return;
            }
            void settle("closed");
          },
        });
      } catch {
        if (cancelled) return;
        clearTimers();
        setPhase({
          kind: "unavailable",
          message: "The payment window could not be opened. Nothing has been charged.",
        });
      }
    })();

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [accessCode, reference, clearTimers, settle]);

  const fact = {
    ...(typeof amountMinor === "number" ? { amountMinor, currency: "NGN" } : {}),
    reference,
  };

  /* The payment's real steps (motion 14), under the two waiting sheets. Each
     ticks only when its phase has genuinely passed: "opening" is done once
     Paystack's window reported that it loaded (only then can a settle run),
     "confirming" is done once our own transaction record says paid, at which
     point the caller swaps this sheet for the receipt. The words are the
     checkout dictionary's own, from the route's CopyScope (W13: a client
     dictionary read here shipped the whole dictionary with the payment). */
  const stepWords = useScopedCopy("checkout");
  const offlineWord = useClientCopy().platform.inflight.offline;
  const steps = (at: "opening" | "settling") => (
    <PaymentSteps
      label={stepWords.confirmingPayment}
      steps={cardPaymentSteps(at, {
        opening: stepWords.openingPaymentPage,
        confirming: stepWords.confirmingPayment,
        received: stepWords.paymentReceived,
      })}
    />
  );

  /* While Paystack's iframe is up it is fixed and full viewport, so our own
     sheet would sit behind it and be read by a screen reader as a second
     dialog over the one the person is using. The `open` phase therefore draws
     nothing at all: the page underneath is ours, the URL is ours, and the
     payment is happening on top of it. */
  if (phase.kind === "open") return null;
  /* Staged: the caller's pay stage draws the wait. */
  if (staged && (phase.kind === "opening" || phase.kind === "settling")) return null;

  if (phase.kind === "opening") {
    return (
      <ResultSheet
        open
        onOpenChange={() => undefined}
        state="pending"
        blocking
        verdict="Opening payment"
        consequence="Nothing has been charged yet. The payment window opens on this page."
        fact={fact}
        locale={locale}
        footnote={steps("opening")}
      />
    );
  }

  if (phase.kind === "settling") {
    return (
      <ResultSheet
        open
        onOpenChange={() => undefined}
        state="pending"
        blocking
        verdict="Confirming payment"
        consequence="We are checking with our own records rather than taking the payment window's word for it. Do not pay again."
        fact={fact}
        locale={locale}
        footnote={steps("settling")}
      />
    );
  }

  if (phase.kind === "unavailable") {
    /* THE PAYMENT NEVER LEAVES THE APP (founder, 9 November 2026). This sheet
       used to offer Paystack's hosted page, which took the member off Vallo
       until it was done. It never does now, on the web or in the native shell:
       the member closes it and tries again here when the window can open. */
    return (
      <ResultSheet
        open
        onOpenChange={(next) => {
          if (!next) {
            finished.current = true;
            handlers.current.onCancelled();
          }
        }}
        state="failed"
        verdict="Cannot pay here right now"
        consequence={`${phase.offline ? offlineWord : phase.message} Nothing has been charged. Close this and try again in a moment.`}
        fact={fact}
        locale={locale}
        actions={[
          {
            label: "Close",
            tone: "primary",
            onClick: () => {
              finished.current = true;
              handlers.current.onCancelled();
            },
          },
        ]}
      />
    );
  }

  return null;
}
