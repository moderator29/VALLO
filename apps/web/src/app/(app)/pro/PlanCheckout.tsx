"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@vallo/i18n/core";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { PaystackCheckout } from "@/components/app/payments/PaystackCheckout";
import {
  startSubscriptionCheckout,
  startSubscriptionTrial,
  subscriptionCheckoutState,
  type SubscriptionRefusal,
} from "@/lib/subscriptions/actions";
import type { PlanOffer, SubscriptionsCopy } from "@/lib/subscriptions/state";
import { fill, longDate, money } from "./plan-format";
import type { PaidPlan } from "./pro-state";
import { nativePlatform } from "@/lib/native/platform";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/* Founder, 8 October 2026 (option A): the iPhone app shows no trial and no
   checkout, so App Review never meets a purchase outside Apple's in-app
   purchase (guideline 3.1.1). Members subscribe on the website; a plan they
   hold works in the app. The server render is the website; the shell reads
   true after hydration. */
const noSubscribe = () => () => {};
function useIosApp(): boolean {
  return useSyncExternalStore(noSubscribe, () => nativePlatform() === "ios", () => false);
}

type Opened = { reference: string; amountMinor: number; accessCode: string; authorizationUrl: string };

/**
 * THE PURCHASE, UNDER THE PLAN PAGE.
 *
 * Before anything is charged the member reads, on the page itself: the price a
 * month and the trial's length (both from the rows), what the plan includes
 * (drawn above by PlanPicker), that it renews monthly and how to cancel.
 *
 *   Start the free trial  no card: the database starts it and grants the plan
 *                         at once (once per member, ever).
 *   Subscribe             a sheet with the terms once more, then Paystack's
 *                         checkout in this page (PaystackCheckout resumes the
 *                         transaction this server opened under the plan's
 *                         Paystack plan code). Paystack charges every month
 *                         after that; Vallo stores no card.
 *
 * NOTHING HERE ACTIVATES ANYTHING. A paid plan is turned on by Paystack's
 * webhook, or by this server verifying the charge with Paystack; the checkout
 * polls our own server for that, and the return page reads the database.
 */
export function PlanCheckout({
  plan,
  offer,
  trialDays,
  locale,
  copy,
  signInHref,
}: {
  plan: PaidPlan;
  offer: PlanOffer;
  trialDays: number | null;
  locale: Locale;
  copy: SubscriptionsCopy;
  signInHref: string;
}) {
  const router = useRouter();
  const [pending, start] = useSafeTransition();
  const [reviewing, setReviewing] = useState(false);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const price = money(plan.priceMinor, locale);
  const days = trialDays != null ? String(trialDays) : "";
  const refusal = (reason: SubscriptionRefusal) => copy.errors[reason as keyof typeof copy.errors] ?? copy.errors.unavailable;
  const iosApp = useIosApp();

  if (offer.kind === "sign-in") {
    return (
      <div className="nf-pro-buy" data-testid="pro-buy" data-offer="sign-in">
        <ButtonLink href={signInHref} variant="primary" full className="nf-btn--reflect">
          {copy.actions.signIn}
        </ButtonLink>
      </div>
    );
  }
  if (iosApp && offer.kind !== "subscribed") {
    return (
      <p className="nf-pro-buy__note" role="status" data-testid="pro-buy" data-offer="ios-app">
        {copy.offer.iosApp}
      </p>
    );
  }
  if (offer.kind === "closed" || offer.kind === "unknown") {
    return (
      <p className="nf-pro-buy__note" role="status" data-testid="pro-buy" data-offer={offer.kind}>
        {offer.kind === "closed" ? copy.offer.closed : copy.offer.unknown}
      </p>
    );
  }
  if (offer.kind === "subscribed") {
    return (
      <p className="nf-pro-buy__note" role="status" data-testid="pro-buy" data-offer="subscribed">
        {fill(offer.same ? copy.offer.subscribedSame : copy.offer.subscribedOther, { plan: offer.planName })}
      </p>
    );
  }

  const startTrial = () =>
    start(async () => {
      try {
        setError(null);
        setNotice(null);
        const result = await startSubscriptionTrial(plan.key);
        if (!result.ok) return setError(result.error);
        if (!result.data.started) return setError(refusal(result.data.reason));
        setNotice(fill(copy.offer.trialStarted, { plan: plan.name, date: longDate(result.data.trialEndsAt, locale) }));
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  const pay = () =>
    start(async () => {
      try {
        setError(null);
        const result = await startSubscriptionCheckout(plan.key);
        if (!result.ok) {
          setReviewing(false);
          return setError(result.error);
        }
        if (!result.data.opened) {
          setReviewing(false);
          return setError(refusal(result.data.reason));
        }
        const { reference, amountMinor, accessCode, authorizationUrl } = result.data;
        setReviewing(false);
        setOpened({ reference, amountMinor, accessCode, authorizationUrl });
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  return (
    <div className="nf-pro-buy" data-testid="pro-buy" data-offer="buy">
      <div className="nf-pro-buy__terms" data-testid="pro-terms">
        <p className="nf-pro-buy__label">{copy.terms.label}</p>
        <ul className="nf-pro-buy__list">
          {offer.trial && days ? <li>{fill(copy.terms.trial, { days })}</li> : null}
          <li className="nf-numeric">{fill(copy.terms.price, { price })}</li>
          <li>{copy.terms.renews}</li>
          <li>{copy.terms.cancel}</li>
          {offer.inTrial && offer.canPay ? <li>{copy.terms.inTrial}</li> : null}
        </ul>
      </div>

      {offer.trial && days ? (
        <Button variant="spark" full onClick={startTrial} loading={pending && !reviewing && opened == null} disabled={pending} data-testid="pro-start-trial">
          {fill(copy.actions.startTrial, { days })}
        </Button>
      ) : null}
      {offer.canPay ? (
        <Button
          variant={offer.trial ? "secondary" : "primary"}
          full
          className={offer.trial ? undefined : "nf-btn--reflect"}
          onClick={() => {
            setError(null);
            setReviewing(true);
          }}
          disabled={pending}
          data-testid="pro-subscribe"
        >
          {fill(copy.actions.subscribe, { price })}
        </Button>
      ) : null}

      {notice ? (
        <p className="nf-pro-buy__notice" role="status" data-testid="pro-buy-notice">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="nf-pro-buy__error" role="alert" data-testid="pro-buy-error">
          {error}
        </p>
      ) : null}

      <Sheet
        open={reviewing}
        onOpenChange={(open) => {
          if (!pending) setReviewing(open);
        }}
        title={fill(copy.review.title, { plan: plan.name })}
        closeLabel={copy.actions.close}
        testId="pro-review"
      >
        <div className="nf-pro-gate">
          <dl className="nf-pro-buy__sum">
            <div>
              <dt>{copy.review.today}</dt>
              <dd className="nf-numeric">{price}</dd>
            </div>
            <div>
              <dt>{copy.review.monthly}</dt>
              <dd className="nf-numeric">{price}</dd>
            </div>
          </dl>
          {offer.inTrial ? <p className="nf-pro-gate__body">{copy.terms.inTrial}</p> : null}
          <p className="nf-pro-gate__body">{copy.review.renews}</p>
          <p className="nf-pro-gate__body">{copy.review.card}</p>
          <Button variant="primary" full onClick={pay} loading={pending} disabled={pending} data-testid="pro-pay">
            {fill(copy.actions.pay, { price })}
          </Button>
        </div>
      </Sheet>

      {opened ? (
        <PaystackCheckout
          key={opened.reference}
          accessCode={opened.accessCode}
          reference={opened.reference}
          authorizationUrl={opened.authorizationUrl}
          amountMinor={opened.amountMinor}
          locale={locale}
          confirm={async (reference) => {
            const state = await subscriptionCheckoutState(reference);
            return state.ok ? state.data : "pending";
          }}
          onPaid={(reference) => {
            setOpened(null);
            router.push(`/pro/confirm?reference=${encodeURIComponent(reference)}`);
          }}
          onCancelled={() => setOpened(null)}
          onFailed={(message) => {
            setOpened(null);
            setError(message);
          }}
        />
      ) : null}
    </div>
  );
}
