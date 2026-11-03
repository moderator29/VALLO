import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { formatMoney, type Locale } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { FUND_BY_LINE, FUND_FROM_BALANCE, FUND_NO_FEE_LINE, FUND_TITLE } from "@/lib/money/copy";
import type { FundFacts, FundModel } from "@/lib/money/fund-model";
/* The reflecting capsule (`.nf-capsule`, D74) lives with the premium moments. */
import "@/app/css/premium-moments.css";
import "./fund-payment.css";

/**
 * STEP 7, FUND (D77): the renter pays the agreed rent into escrow. The Plasma
 * standard (D74): a quiet near-black field and ONE platinum object, the rent
 * itself, huge, its unit softer; under it, in the same object, the balance it
 * comes from and a meter of how much of the rent that balance covers. One
 * action: the money swipe when the balance covers it, otherwise the capsule
 * that takes the renter to top up. What happens next is three steps on the
 * field, the first of them now. The swipe hands off to /agreements/[id]/held.
 *
 * Presentational: the page passes the live control, the dev preview a
 * recorded one, so both draw exactly this.
 */
export function FundScreen({
  facts,
  model,
  locale,
  control,
  backHref,
  fallback,
}: {
  facts: FundFacts;
  model: Exclude<FundModel, { kind: "go_held" }>;
  locale: Locale;
  /** The swipe, offered only when the model is ready. */
  control: ReactNode;
  backHref: string;
  /**
   * The calm way out to card (founder instruction, 13 October 2026: nobody is
   * stranded), drawn only where the page read that card is allowed here.
   */
  fallback?: ReactNode;
}) {
  const money = (minor: number) => formatMoney(minor, locale, "NGN");
  const full = money(facts.amountMinor);
  const figure = full.replace(/^₦\s?/, "");
  const eyebrow = facts.moveIn ? `${facts.placeTitle} · Move-in ${facts.moveIn}` : facts.placeTitle;

  return (
    <section className="nf-fund" aria-labelledby="fund-title" data-testid="fund-payment" data-state={model.kind === "fund" ? (model.ready ? "ready" : "short") : model.reason}>
      <header>
        <p className="nf-fund__eyebrow">{eyebrow}</p>
        <h1 id="fund-title" className="nf-fund__title">
          {FUND_TITLE}
        </h1>
      </header>

      {model.kind === "closed" ? (
        <div className="nf-fund__closed" role="status">
          <p>{model.body}</p>
          {fallback ?? null}
          <Link href={backHref} className="nf-fund__quiet nf-tap">
            Back to the agreement
          </Link>
        </div>
      ) : (
        <>
          <div className="nf-fund__card" data-testid="fund-card">
            <p className="nf-fund__label">The agreed rent, paid to {facts.counterpartName} once you confirm</p>
            <p className="nf-fund__figure" aria-label={full}>
              <span className="nf-fund__unit" aria-hidden>
                ₦
              </span>
              <span aria-hidden>{figure}</span>
            </p>
            <p className="nf-fund__by">
              <UiIcon name="shield-lock" size={16} />
              {FUND_BY_LINE}
            </p>

            <div className="nf-fund__source" data-testid="fund-balance">
              <div className="nf-fund__source-row">
                <span className="nf-fund__label">
                  <UiIcon name="wallet" size={16} />
                  {FUND_FROM_BALANCE}
                </span>
                <span className="nf-fund__value">{model.availableMinor === null ? "Not open yet" : money(model.availableMinor)}</span>
              </div>
              <div
                className="nf-fund__meter"
                role="meter"
                aria-label="How much of the rent your balance covers"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(model.cover * 100)}
                style={{ "--nf-fund-cover": String(model.cover) } as CSSProperties}
              >
                <span className="nf-fund__meter-fill" />
              </div>
              <p className="nf-fund__cover" data-short={model.shortMinor > 0 ? "true" : undefined}>
                {model.ready
                  ? "Your balance covers it."
                  : model.availableMinor === null
                    ? "Open your balance and add the rent, then pay it in here."
                    : `${money(model.shortMinor)} more needed in your balance.`}
                {model.balanceStale ? " Last figure from our licensed provider; it will refresh." : ""}
              </p>
            </div>

            <p className="nf-fund__fee">
              <UiIcon name="check" size={16} />
              {FUND_NO_FEE_LINE}
            </p>
          </div>

          <ol className="nf-fund__steps" aria-label="What happens next">
            {model.steps.map((step, i) => (
              <li key={step.title} className="nf-fund__step" data-state={i === 0 ? "now" : "next"}>
                <span className="nf-fund__dot" aria-hidden>
                  {i + 1}
                </span>
                <div>
                  <p className="nf-fund__step-title">{step.title}</p>
                  <p className="nf-fund__step-body">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="nf-fund__action">
            {model.ready ? (
              control
            ) : model.balanceAction ? (
              <Link href={model.balanceAction.href} className="nf-capsule" data-testid="fund-top-up">
                <UiIcon name="plus" size={16} />
                {model.balanceAction.label}
              </Link>
            ) : null}
            {fallback ?? null}
            <Link href={backHref} className="nf-fund__quiet nf-tap">
              Back to the agreement
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
