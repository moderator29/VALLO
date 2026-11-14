"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { formatMoney, type Dictionary, type Locale } from "@vallo/i18n/core";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Odometer } from "@/components/ui/Odometer";
import { UiIcon } from "@/design-system/icons/UiIcon";
import {
  bpsLabel,
  CALCULATOR_STATES,
  computeMoveIn,
  FEE_LINES,
  publishedRule,
  queryFromInput,
  type FeeInput,
  type FeeLine,
  type MoveInInput,
} from "@/lib/site/move-in-calculator";
import { banner } from "@/lib/ui/toast";
import { FieldProblem } from "@/components/ui/FieldProblem";

type Copy = Dictionary["publicDoors"]["moveIn"];

/*
 * ONE HUE, IN STEPS (north star 3 and the chart rules in
 * `components/ui/charts/chart-rules.ts`: brand for the subject, the rest in
 * quieter steps of it, never a colour per series). The bar used to paint the
 * six lines in six hues (brand, info, neutral, success, warning, error),
 * which is the four-hue chart the specification refuses, and it made a fee
 * look like an error. Each line now takes its step by its place in the
 * total, the rent strongest; the list under the bar names every line and its
 * amount, so nothing depends on telling the steps apart.
 */
const STEPS = 6;

/**
 * A8. The move-in calculator at `/move-in-cost`.
 *
 * Every figure is typed by the visitor; the only one Vallo offers is a
 * published rule's maximum (Lagos today), filled in only on a tap and labelled
 * as the most the rule allows. The arithmetic is `computeMoveIn`, which runs
 * the listing's own `cashAtDoor`. The page renders the result for the query
 * it was opened with (a shared link opens on the same total), and this
 * component updates it as the visitor types.
 *
 * IT LEADS WITH ITS FIGURE (north star 10 J; Session 3). The total is the
 * subject of the page, so it comes first: on a phone a slim strip carrying
 * the total sticks under the bar while the visitor types further down, so
 * the figure is never off screen when it changes; from 60rem the result card
 * is the first column, sticky beside the form. The total rolls only the
 * digits that changed (`Odometer`, north star motion 5) as each figure is
 * typed. It is the visitor's own arithmetic, not money that moved, so the
 * odometer's money rule (never optimistic) does not bite.
 */
export function MoveInCalculator({
  copy,
  locale,
  initial,
  initialState,
  origin,
}: {
  copy: Copy;
  locale: Locale;
  initial: MoveInInput;
  initialState: string;
  origin: string;
}) {
  const id = useId();
  const [rent, setRent] = useState(initial.rent);
  const [years, setYears] = useState(String(initial.years) as "1" | "2" | "3");
  const [state, setState] = useState(initialState);
  const [fees, setFees] = useState<Partial<Record<FeeLine, FeeInput>>>(initial.fees);
  const [copied, setCopied] = useState(false);

  const input: MoveInInput = useMemo(() => ({ rent, years: Number(years), fees }), [rent, years, fees]);
  const result = computeMoveIn(input);
  const rule = publishedRule(state);
  const query = queryFromInput(input, state);

  /* The address bar follows the figures, so a copied or bookmarked address
     opens the same total. `replaceState` so typing writes no history. */
  useEffect(() => {
    const url = `${window.location.pathname}${query}`;
    window.history.replaceState(window.history.state, "", url);
  }, [query]);

  const setFee = (key: FeeLine, patch: Partial<FeeInput>) =>
    setFees((prev) => ({ ...prev, [key]: { mode: prev[key]?.mode ?? "amount", value: prev[key]?.value ?? "", ...patch } }));

  const lineLabel = (key: "rent" | FeeLine) =>
    key === "rent" && Number(years) > 1 ? copy.lines.rentYears.replace("{years}", years) : copy.lines[key];

  const money = (minor: number) => formatMoney(minor, locale);
  const shareUrl = `${origin.replace(/\/+$/, "")}/move-in-cost${query}`;

  async function share() {
    if (result.state !== "ok") return;
    const text = copy.shareText
      .replace("{rent}", money(result.rentMinor))
      .replace("{total}", money(result.totalMinor))
      .replace("{url}", shareUrl);
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* Dismissed or refused: fall through to WhatsApp. */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      /* The button keeps its tick; the quick pill says it (founder, 14 November 2026). */
      banner.quick(copy.copied);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  }

  const invalid = result.state === "invalid" ? result.field : null;

  return (
    <div className="nf-calc">
      {/* The phone's leading strip: the total, sticky while the form is typed
          into. The result card below is the live region, so this copy is
          hidden from assistive technology rather than read twice. */}
      <div className="nf-calc__lead" aria-hidden="true">
        <span className="nf-calc__lead-label">{copy.totalLabel}</span>
        {result.state === "ok" ? (
          <Odometer value={money(result.totalMinor)} className="nf-calc__lead-figure nf-numeric" />
        ) : (
          <span className="nf-calc__lead-empty">{copy.compactPlaceholder}</span>
        )}
      </div>
      <form method="get" action="/move-in-cost" className="nf-pd-card nf-calc__form" onSubmit={(e) => e.preventDefault()}>
        <div className="nf-calc__field">
          <label htmlFor={`${id}-rent`} className="nf-label">
            {copy.rentLabel}
          </label>
          <div className="nf-calc__money">
            <span className="nf-calc__currency" aria-hidden="true">
              ₦
            </span>
            <input
              id={`${id}-rent`}
              name="rent"
              className="nf-field nf-calc__input nf-numeric"
              inputMode="decimal"
              autoComplete="off"
              placeholder={copy.rentPlaceholder}
              value={rent}
              onChange={(e) => setRent(e.target.value.slice(0, 18))}
              aria-invalid={invalid === "rent" || undefined}
              aria-describedby={`${id}-rent-hint`}
              data-testid="calc-rent"
            />
          </div>
          <p id={`${id}-rent-hint`} className="nf-caption text-[var(--nf-content-muted)]">
            {copy.rentHint}
          </p>
          {/* The field keeps its red edge; the words go to the one banner (founder, 7 November 2026). */}
          <FieldProblem id={`${id}-rent-problem`} message={invalid === "rent" ? copy.invalid : null} />
        </div>

        <div className="nf-calc__row">
          <div className="nf-calc__field">
            <span className="nf-label" id={`${id}-years`}>
              {copy.upfrontLabel}
            </span>
            <input type="hidden" name="years" value={years} />
            <Segmented
              semantics="radio"
              label={copy.upfrontLabel}
              value={years}
              onChange={setYears}
              full
              options={[
                { value: "1", label: copy.upfrontOne },
                { value: "2", label: copy.upfrontTwo },
                { value: "3", label: copy.upfrontThree },
              ]}
            />
          </div>
          <div className="nf-calc__field">
            <label htmlFor={`${id}-state`} className="nf-label">
              {copy.stateLabel}
            </label>
            <select
              id={`${id}-state`}
              name="state"
              className="nf-field"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              <option value="">{copy.stateOther}</option>
              {CALCULATOR_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {rule && (
          <div className="nf-calc__rule" data-testid="calc-rule">
            <p className="nf-calc__rule-title">
              <UiIcon name="scale" size={16} aria-hidden />
              {copy.ruleTitle.replace("{state}", rule.stateName)}
            </p>
            <p className="nf-caption text-[var(--nf-content-secondary)]">
              {copy.ruleBody
                .replace("{agency}", bpsLabel(rule.agencyMaxBps))
                .replace("{legal}", bpsLabel(rule.legalMaxBps))
                .replace("{source}", rule.source)}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setFee("agency", { mode: "percent", value: String(rule.agencyMaxBps / 100) });
                setFee("legal", { mode: "percent", value: String(rule.legalMaxBps / 100) });
              }}
            >
              {copy.ruleFill}
            </Button>
            <p className="nf-caption text-[var(--nf-content-muted)]">{copy.ruleNote}</p>
          </div>
        )}

        <fieldset className="nf-calc__fees">
          <legend className="nf-section-label">{copy.feesTitle}</legend>
          <p className="nf-caption text-[var(--nf-content-muted)]">{copy.feesHint}</p>
          {FEE_LINES.map((key) => {
            const fee = fees[key];
            const mode = fee?.mode ?? "amount";
            return (
              <div key={key} className="nf-calc__fee">
                <label htmlFor={`${id}-${key}`} className="nf-calc__fee-label">
                  {copy.lines[key]}
                </label>
                <div className="nf-calc__fee-input">
                  <input
                    id={`${id}-${key}`}
                    name={key}
                    className="nf-field nf-numeric"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    value={fee?.value ?? ""}
                    onChange={(e) => setFee(key, { value: e.target.value.slice(0, 18) })}
                    aria-invalid={invalid === key || undefined}
                    data-testid={`calc-${key}`}
                  />
                  <Segmented
                    semantics="radio"
                    size="sm"
                    label={`${copy.lines[key]}: ${copy.asAmount} / ${copy.asPercent}`}
                    value={mode}
                    onChange={(next) => setFee(key, { mode: next })}
                    options={[
                      { value: "amount", label: "₦" },
                      { value: "percent", label: "%" },
                    ]}
                  />
                </div>
                <FieldProblem id={`${id}-${key}-problem`} message={invalid === key ? copy.invalid : null} />
              </div>
            );
          })}
        </fieldset>
      </form>

      <section className="nf-pd-card nf-calc__result" aria-live="polite" aria-labelledby={`${id}-total`}>
        {/* The centred hero figure (spec section 17): caption, figure, then the bar. */}
        <p id={`${id}-total`} className="nf-section-label nf-calc__caption">
          {copy.totalLabel}
        </p>
        {result.state === "ok" ? (
          <>
            <p className="nf-calc__total nf-numeric" data-testid="calc-total">
              <Odometer value={money(result.totalMinor)} />
            </p>
            <div className="nf-calc__bar" role="img" aria-label={copy.barLabel}>
              {result.lines.map((line, i) => (
                <span
                  key={line.key}
                  data-step={Math.min(i, STEPS - 1)}
                  style={{ flexGrow: Math.max(line.minor, 1) }}
                />
              ))}
            </div>
            <ul className="nf-calc__lines">
              {result.lines.map((line, i) => (
                <li key={line.key}>
                  <span className="nf-calc__dot" data-step={Math.min(i, STEPS - 1)} aria-hidden="true" />
                  <span className="nf-calc__line-label">{lineLabel(line.key)}</span>
                  <span className="nf-calc__line-value nf-numeric">{money(line.minor)}</span>
                </li>
              ))}
            </ul>
            <p className="nf-caption text-[var(--nf-content-muted)]">{copy.totalNote}</p>
            <div className="nf-calc__actions">
              <Button type="button" variant="secondary" size="md" leadingIcon="share" onClick={share}>
                {copy.share}
              </Button>
              <Button type="button" variant="ghost" size="md" leadingIcon="link" onClick={copyLink}>
                {copied ? copy.copied : copy.copyLink}
              </Button>
            </div>
          </>
        ) : (
          <p className="nf-calc__empty" data-tone={result.state === "invalid" ? "error" : undefined}>
            {result.state === "invalid" ? copy.invalid : copy.emptyTotal}
          </p>
        )}
        <div className="nf-calc__cta">
          <ButtonLink href="/start" variant="primary" size="lg" full trailingIcon="arrow-right">
            {copy.cta}
          </ButtonLink>
          <p className="nf-caption text-[var(--nf-content-muted)]">{copy.ctaNote}</p>
        </div>
      </section>
    </div>
  );
}
