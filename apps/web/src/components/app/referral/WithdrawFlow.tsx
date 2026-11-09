"use client";

import "./rewards.css";
import { useEffect, useState } from "react";
import { banner } from "@/lib/ui/toast";
import Link from "next/link";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { Button, ButtonLink } from "@/components/ui/Button";
import { NairaField } from "@/components/ui/NairaField";
import { Panel } from "@/components/ui/Panel";
import {
  checkWithdrawAmount,
  nairaToKobo,
  quoteAddsUp,
  type PayoutDestination,
  type WithdrawActions,
  type WithdrawQuote,
} from "@/lib/referral/rewards";
import { feedback } from "@/lib/ui/feedback";
import { money } from "./format";
import { fill, type RewardsMoneyWords } from "./money-words";

type Copy = Dictionary["experienceRewards"]["withdraw"];

type Phase =
  | { at: "enter"; error: string | null }
  | { at: "quoting" }
  | { at: "quoted"; quote: WithdrawQuote; error: string | null }
  | { at: "confirming"; quote: WithdrawQuote }
  | { at: "done" };

/**
 * WITHDRAWING FROM THE REWARDS BALANCE (D51, VALLO_PRICING section 3).
 *
 * THE ORDER IS THE POINT. Before anything is prepared the member sees what
 * they have available, the minimum, where it will be paid, and the sentence
 * saying the fee is set when it is prepared. Then "See the fee" asks the
 * payout provider to prepare the withdrawal and read its fee back; only then
 * are three figures drawn, Amount, Processing fee and You'll receive, at the
 * same weight, and only then is Confirm offered.
 *
 * WHAT IT REFUSES TO DO:
 *   - quote a fee from a table or an estimate. There is no fee figure in this
 *     file; every one is the provider's, from `WithdrawActions.quote`;
 *   - draw a total that does not add up (`quoteAddsUp`): amount minus fee must
 *     be exactly what arrives, in whole kobo, or nothing is shown;
 *   - send an amount below the minimum or above what is available: both are
 *     said before the provider is ever asked;
 *   - say "paid" or "successful". A confirmed withdrawal is handed to the
 *     provider and is processing; the history says when the bank confirms.
 *
 * One keystroke never moves money: Confirm is a separate press after the
 * figures are on screen, and it carries the prepared quote's id, so an amount
 * edited after the fee was read must be priced again.
 */
export function WithdrawFlow({
  availableMinor,
  minimumMinor,
  destination,
  actions,
  copy,
  money: words,
  locale,
  historyHref,
  backHref,
}: {
  availableMinor: number;
  minimumMinor: number;
  destination: PayoutDestination;
  actions: WithdrawActions;
  copy: Copy;
  money: Pick<RewardsMoneyWords, "minimum" | "feeFirst" | "paidFrom">;
  locale: Locale;
  historyHref: string;
  backHref: string;
}) {
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<Phase>({ at: "enter", error: null });
  /* Said by the one banner at the top of the screen (founder, 7 November
     2026): a refusal on the quote, and the request once it is in. The
     amount field says its own problem through its Field. */
  useEffect(() => {
    if (phase.at === "quoted" && phase.error) banner.error(phase.error);
    else if (phase.at === "done") banner.success(copy.done.title, { "data-testid": "banner-rewards-withdrawn" });
    // Once per phase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  const minimum = money(minimumMinor, locale);
  const to = copy.toValue.replace("{bank}", destination.bankName).replace("{last4}", destination.accountLast4);

  const prepare = async () => {
    const amount = nairaToKobo(typed);
    const check = checkWithdrawAmount(amount, availableMinor, minimumMinor);
    if (check !== "ok" || amount === null) {
      const error =
        check === "below-minimum"
          ? copy.errors.belowMinimum.replace("{amount}", minimum)
          : check === "above-available"
            ? copy.errors.aboveAvailable.replace("{amount}", money(availableMinor, locale))
            : copy.errors.empty;
      setPhase({ at: "enter", error });
      return;
    }
    setPhase({ at: "quoting" });
    let result;
    try {
      result = await actions.quote(amount);
    } catch {
      result = { ok: false as const, reason: "unavailable" as const };
    }
    if (!result.ok) {
      const error =
        result.reason === "below-minimum"
          ? copy.errors.belowMinimum.replace("{amount}", minimum)
          : result.reason === "above-available"
            ? copy.errors.aboveAvailable.replace("{amount}", money(availableMinor, locale))
            : result.reason === "no-destination"
              ? copy.errors.noDestination
              : copy.errors.unavailable;
      setPhase({ at: "enter", error });
      return;
    }
    if (!quoteAddsUp(result.quote, amount)) {
      setPhase({ at: "enter", error: copy.errors.mismatch });
      return;
    }
    setPhase({ at: "quoted", quote: result.quote, error: null });
  };

  const confirm = async (quote: WithdrawQuote) => {
    setPhase({ at: "confirming", quote });
    let result;
    try {
      result = await actions.confirm(quote.quoteId);
    } catch {
      result = { ok: false as const, reason: "unavailable" as const };
    }
    if (result.ok) {
      feedback("success");
      setPhase({ at: "done" });
      return;
    }
    if (result.reason === "expired") {
      setPhase({ at: "enter", error: copy.errors.expired });
      return;
    }
    setPhase({ at: "quoted", quote, error: copy.errors.confirmFailed });
  };

  if (phase.at === "done") {
    return (
      <Panel variant="card" className="nf-rewards-campaign" role="status" data-testid="rewards-withdraw-done">
        <h2 className="nf-h3">{copy.done.title}</h2>
        <p className="nf-rewards-note">{copy.done.body}</p>
        <ButtonLink href={historyHref} variant="secondary" size="lg" full>
          {copy.done.action}
        </ButtonLink>
      </Panel>
    );
  }

  const quote = phase.at === "quoted" || phase.at === "confirming" ? phase.quote : null;
  const error = phase.at === "enter" || phase.at === "quoted" ? phase.error : null;

  return (
    <div className="nf-rewards-withdraw" data-testid="rewards-withdraw">
      <Panel variant="card" className="nf-rewards-campaign">
        <dl className="nf-rewards-facts">
          <div>
            <dt>{copy.available}</dt>
            <dd data-testid="withdraw-available">{money(availableMinor, locale)}</dd>
          </div>
          <div>
            <dt>{copy.minimum}</dt>
            <dd data-testid="withdraw-minimum">{minimum}</dd>
          </div>
          <div>
            <dt>{copy.to}</dt>
            <dd>{to}</dd>
          </div>
        </dl>
        <p className="nf-rewards-note">{fill(words.minimum, { minimum })}</p>
        <p className="nf-rewards-note">{words.paidFrom}</p>
      </Panel>

      {quote ? (
        <Panel variant="card" className="nf-rewards-campaign" aria-labelledby="withdraw-breakdown" data-testid="withdraw-breakdown">
          <h2 id="withdraw-breakdown" className="nf-rewards-figures__label">
            {copy.breakdown.title}
          </h2>
          <dl className="nf-rewards-facts">
            <div>
              <dt>{copy.breakdown.amount}</dt>
              <dd data-testid="withdraw-amount">{money(quote.amountMinor, locale)}</dd>
            </div>
            <div>
              <dt>{copy.breakdown.fee}</dt>
              <dd data-testid="withdraw-fee">{money(quote.feeMinor, locale)}</dd>
            </div>
            <div data-total="">
              <dt>{copy.breakdown.receive}</dt>
              <dd data-testid="withdraw-receive">{money(quote.receiveMinor, locale)}</dd>
            </div>
          </dl>
          <Button
            type="button"
            variant="primary"
            size="lg"
            full
            loading={phase.at === "confirming"}
            onClick={() => void confirm(quote)}
            data-testid="withdraw-confirm"
          >
            {copy.confirm}
          </Button>
          <Button
            type="button"
            variant="quiet"
            size="md"
            full
            disabled={phase.at === "confirming"}
            onClick={() => setPhase({ at: "enter", error: null })}
            data-testid="withdraw-change"
          >
            {copy.change}
          </Button>
        </Panel>
      ) : (
        <form
          className="nf-rewards-withdraw"
          onSubmit={(event) => {
            event.preventDefault();
            void prepare();
          }}
        >
          <NairaField
            label={copy.amountLabel}
            value={typed}
            onValueChange={(value) => {
              setTyped(value);
              if (phase.at === "enter" && phase.error) setPhase({ at: "enter", error: null });
            }}
            error={error ?? undefined}
            data-testid="withdraw-amount-field"
          />
          <p className="nf-rewards-note">{words.feeFirst}</p>
          <Button type="submit" variant="primary" size="lg" full loading={phase.at === "quoting"} data-testid="withdraw-prepare">
            {copy.prepare}
          </Button>
        </form>
      )}
      <p className="nf-rewards-note text-center">
        <Link className="nf-link" href={backHref}>
          {copy.back}
        </Link>
      </p>
    </div>
  );
}
