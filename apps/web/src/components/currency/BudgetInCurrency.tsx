"use client";

import { useId, useState } from "react";
import { formatMoney, formatNumber, type Locale } from "@vallo/i18n/core";
import { CURRENCY_META } from "@/lib/currency/currencies";
import { showsGuide } from "@/lib/currency/display";
import { budgetNairaFromUnits, budgetUnitsFromNaira } from "@/lib/currency/budget";
import { useDisplayMoney } from "./DisplayMoneyProvider";

/**
 * THE SEARCH BUDGET, TYPED IN THE READER'S CURRENCY (currency tool 2).
 *
 * Two fields under the filter sheet's naira budget. A reader who thinks in
 * pounds types "1,500" and the naira field above it takes the naira that is
 * worth; the line underneath says, in naira, what the search will use. The
 * naira fields stay the truth: this writes into them and reads back from
 * them, so the slider, the address bar and a saved search are naira exactly
 * as before. See `lib/currency/budget.ts` and the header of `currencies.ts`.
 *
 * DRAWN ONLY WHEN THE PAGE SHOWS A GUIDE: a provider above it, a currency
 * other than naira, and a rate that was fresh when the server built the page.
 * Otherwise nothing is drawn and nothing suggests a conversion exists.
 *
 * WHAT A FIELD SHOWS. What the reader typed, for as long as the naira field
 * still holds what that produced. Once the naira is changed some other way
 * (the slider, the naira field, Clear) the field shows that naira read in the
 * reader's currency, worked as a guide figure is, so the two rows never disagree.
 */

/* English only for now, beside the sheet's other Grade 1 words. */
const WORDS = {
  title: "Budget in {currency}",
  min: "Minimum budget in {currency}",
  max: "Maximum budget in {currency}",
  idle: "Type it in {currency} and the search turns it into naira, as a guide at a recent rate.",
  uses: "The search uses naira: {range}. A guide at a recent rate, not a price.",
  between: "{min} to {max}",
  from: "{min} and above",
  upTo: "up to {max}",
};

type Side = "min" | "max";
type Typed = { text: string; naira: string };

function digits(value: string): string {
  return value.replace(/[^0-9]/g, "").slice(0, 9);
}

export function BudgetInCurrency({
  minNaira,
  maxNaira,
  onChange,
  locale,
  placeholders,
}: {
  /** The sheet's own naira fields, whole naira as digits, "" when unset. */
  minNaira: string;
  maxNaira: string;
  onChange: (next: { minNaira?: string; maxNaira?: string }) => void;
  locale: Locale;
  placeholders?: { min?: string | undefined; max?: string | undefined };
}) {
  const context = useDisplayMoney();
  const display = context?.display ?? null;
  const titleId = useId();
  const [typed, setTyped] = useState<Record<Side, Typed | null>>({ min: null, max: null });

  if (!display || !showsGuide(display)) return null;

  const meta = CURRENCY_META[display.currency];
  const naira: Record<Side, string> = { min: minNaira, max: maxNaira };

  function shown(side: Side): string {
    const mine = typed[side];
    if (mine && mine.naira === naira[side]) return mine.text;
    const units = naira[side] ? budgetUnitsFromNaira(Number(naira[side]), display) : null;
    return units === null ? "" : String(units);
  }

  function type(side: Side, value: string) {
    const text = digits(value);
    const worth = text ? budgetNairaFromUnits(Number(text), display) : null;
    const next = worth === null ? "" : String(worth);
    setTyped((current) => ({ ...current, [side]: { text, naira: next } }));
    onChange(side === "min" ? { minNaira: next } : { maxNaira: next });
  }

  /* The bounds as the search will read them: in order, as `queryFrom` puts them. */
  const set = [minNaira, maxNaira].map((value) => (value ? Number(value) : undefined));
  let [low, high] = set;
  if (low !== undefined && high !== undefined && low > high) [low, high] = [high, low];
  const money = (value: number) => formatMoney(value * 100, locale);
  const range =
    low !== undefined && high !== undefined
      ? WORDS.between.replace("{min}", money(low)).replace("{max}", money(high))
      : low !== undefined
        ? WORDS.from.replace("{min}", money(low))
        : high !== undefined
          ? WORDS.upTo.replace("{max}", money(high))
          : null;

  const field = (side: Side) => {
    const value = shown(side);
    return (
      <label className="nf-price-field">
        <span className="sr-only">{(side === "min" ? WORDS.min : WORDS.max).replace("{currency}", meta.spoken)}</span>
        <span className="nf-price-field__unit" aria-hidden="true">
          {meta.symbol}
        </span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          data-testid={`filter-budget-${side}`}
          placeholder={side === "min" ? placeholders?.min : placeholders?.max}
          value={value ? formatNumber(Number(value), locale) : ""}
          onChange={(event) => type(side, event.target.value)}
          className="nf-price-field__input"
        />
      </label>
    );
  };

  return (
    <div role="group" aria-labelledby={titleId} className="mt-md" data-testid="filter-budget-currency" data-guide={display.currency}>
      <p id={titleId} className="nf-caption mb-xs font-semibold text-[var(--nf-content-secondary)]">
        {WORDS.title.replace("{currency}", meta.spoken)}
      </p>
      <div className="nf-price-fields mb-xs">
        {field("min")}
        <span className="nf-price-fields__dash" aria-hidden="true" />
        {field("max")}
      </div>
      <p className="nf-filters__hint mb-0" aria-live="polite" data-testid="filter-budget-note">
        {range ? WORDS.uses.replace("{range}", range) : WORDS.idle.replace("{currency}", meta.spoken)}
      </p>
    </div>
  );
}
