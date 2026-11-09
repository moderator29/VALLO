"use client";

import { banner } from "@/lib/ui/toast";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import { cancelSubscription } from "@/lib/subscriptions/actions";
import type { LiveSubscription, SubscriptionsCopy } from "@/lib/subscriptions/state";
import { fill, longDate, money } from "./plan-format";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * THE PLAN A MEMBER HOLDS THROUGH A SUBSCRIPTION, AND THE WAY OUT OF IT.
 *
 * Every date and amount is the subscription row's: the trial's end, the end
 * of the period paid for (the next charge date while it renews) and the
 * monthly amount frozen when they subscribed. A trial needs no cancelling:
 * nothing is charged and it ends on its own. A paid plan is cancelled here:
 * Paystack stops the renewal, and the member keeps the plan to the end of the
 * period already paid for.
 */
export function ManagePlan({
  live,
  locale,
  copy,
  label,
}: {
  live: LiveSubscription;
  locale: Locale;
  copy: SubscriptionsCopy;
  /** "Your plan", from the page's own words. */
  label: string;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, start] = useSafeTransition();
  /* Cancelled on this visit: the button goes, and the banner says so. */
  const [done, setDone] = useState(false);
  const m = copy.manage;

  let tone: StatusTone = "brand";
  let word = m.trialing;
  const lines: string[] = [];
  if (live.kind === "trial") {
    lines.push(fill(m.trialEnds, { date: longDate(live.trialEndsAt, locale) }), m.trialBody);
  } else {
    const date = longDate(live.periodEnd, locale);
    if (live.status === "active") {
      tone = "success";
      word = m.active;
      if (date) lines.push(fill(m.nextCharge, { price: money(live.amountMinor, locale), date }));
      lines.push(m.renewsBody);
    } else if (live.status === "past_due") {
      tone = "warning";
      word = m.pastDue;
      lines.push(fill(m.pastDueBody, { date }));
    } else {
      tone = "neutral";
      word = m.nonRenewing;
      lines.push(fill(m.endsOn, { plan: live.planName, date }));
    }
  }
  const cancellable = live.kind === "paid" && (live.status === "active" || live.status === "past_due") && !done;
  const until = live.kind === "paid" ? longDate(live.periodEnd, locale) : "";

  const cancel = () =>
    start(async () => {
      try {
        /* Said by the one banner at the top of the screen (Grade 1). */
        const result = await cancelSubscription(live.id);
        if (!result.ok) {
          banner.error(result.error, { "data-testid": "pro-cancel-error" });
          return;
        }
        if (!result.data.cancelled) {
          banner.error(copy.errors[result.data.reason as keyof typeof copy.errors] ?? copy.errors.cancel_failed, {
            "data-testid": "pro-cancel-error",
          });
          return;
        }
        setAsking(false);
        setDone(true);
        banner.success(m.cancelled, { "data-testid": "pro-cancel-done" });
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });

  return (
    <div className="nf-pro-mine" data-state="subscribed" data-status={live.kind === "trial" ? "trialing" : live.status} data-testid="pro-plan-state">
      <span className="nf-pro-mine__label">{label}</span>
      <div className="nf-pro-mine__row">
        <p className="nf-pro-mine__name">{live.planName}</p>
        <StatusPill tone={tone}>{word}</StatusPill>
      </div>
      {lines.map((line) => (
        <p key={line} className="nf-pro-mine__body nf-numeric">
          {line}
        </p>
      ))}
      {cancellable ? (
        <Button variant="secondary" full onClick={() => setAsking(true)} data-testid="pro-cancel">
          {copy.actions.cancel}
        </Button>
      ) : null}

      <Sheet
        open={asking}
        onOpenChange={(open) => {
          if (!pending) setAsking(open);
        }}
        title={fill(m.cancelTitle, { plan: live.planName })}
        closeLabel={copy.actions.close}
        testId="pro-cancel-sheet"
      >
        <div className="nf-pro-gate">
          <p className="nf-pro-gate__body">
            {until && live.kind === "paid" && live.status === "active"
              ? fill(m.cancelBody, { plan: live.planName, date: until })
              : m.cancelBodyNow}
          </p>
          <Button variant="danger" full onClick={cancel} loading={pending} disabled={pending} data-testid="pro-cancel-confirm">
            {copy.actions.confirmCancel}
          </Button>
          <Button variant="secondary" full onClick={() => setAsking(false)} disabled={pending}>
            {copy.actions.keep}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
