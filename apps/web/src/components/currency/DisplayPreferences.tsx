"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@vallo/i18n/core";
import {
  AUTO_CURRENCY,
  CURRENCY_META,
  DISPLAY_CURRENCIES,
  type CurrencyChoice,
  type DisplayCurrency,
} from "@/lib/currency/currencies";
import { formatArea, type AreaUnit } from "@/lib/currency/area";
import { currencyLabel, type DisplayMoney } from "@/lib/currency/display";
import { saveDisplayPreferences } from "@/lib/currency/actions";
import { RowButton, RowSegment, RowValue, Sheet } from "@/components/app/account/rows";
import { Price } from "./Price";
import type { GuideCopy } from "./DisplayMoneyProvider";

/**
 * SETTINGS, LANGUAGE AND CURRENCY: the reader's currency and floor-area unit.
 *
 * The Currency row opens a sheet: Automatic first (with what it picks for
 * this reader right now), then the currencies by name and code, as native
 * radio buttons (one tab stop, arrow keys move and choose). The sheet's
 * opening lines say plainly that payment is always in naira and that the
 * other currency is an approximate guide. Choosing saves at once (on this
 * device, and on the account when signed in) and the page re-renders on the
 * server, so the example below and every page after it show the new choice
 * on their first paint.
 *
 * The example row is the proof surface: it draws a real naira price through
 * the same `<Price>` every browsing page will use, with the stored rate.
 */

export type PreferencesCopy = GuideCopy & {
  currency: string;
  currencySub: string;
  sheetTitle: string;
  sheetIntro: string;
  automatic: string;
  automaticSub: string;
  nairaSub: string;
  example: string;
  exampleSub: string;
  area: string;
  areaSub: string;
  areaSqm: string;
  areaSqft: string;
  sqmShort: string;
  sqftShort: string;
  areaExample: string;
  saveFailed: string;
};

/** The example: a stay at ₦250,000 a night, in kobo. */
export const EXAMPLE_NIGHT_MINOR = 25_000_000;
export const EXAMPLE_AREA_SQM = 120;

export function CurrencyRows({
  display,
  copy,
  locale,
  exampleNaira,
}: {
  display: DisplayMoney;
  copy: PreferencesCopy;
  locale: Locale;
  /** "₦250,000", formatted on the server for the example's sub line. */
  exampleNaira: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<CurrencyChoice>(display.choice);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /* The server's answer is the truth once it arrives (after a refresh, or a
     change made on another device): adopted during render, React's pattern
     for state that follows a prop, so there is no extra effect pass. */
  const [served, setServed] = useState<CurrencyChoice>(display.choice);
  if (served !== display.choice) {
    setServed(display.choice);
    setChoice(display.choice);
  }

  const choose = (next: CurrencyChoice) => {
    setOpen(false);
    if (next === choice) return;
    const previous = choice;
    setChoice(next);
    setError(null);
    startTransition(async () => {
      const result = await saveDisplayPreferences({ currency: next }).catch(() => null);
      if (!result) {
        setChoice(previous);
        setError(copy.saveFailed);
        return;
      }
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  const valueFor = (value: CurrencyChoice) =>
    value === AUTO_CURRENCY ? `${copy.automatic} (${display.automatic})` : value;

  const options = currencyOptions(copy, display.automatic);

  return (
    <>
      <RowButton
        icon="banknote"
        label={copy.currency}
        sub={error ?? copy.currencySub}
        value={valueFor(choice)}
        onClick={() => setOpen(true)}
        disabled={pending}
        testId="setting-currency"
      />
      <RowValue
        icon="coins"
        label={copy.example}
        sub={copy.exampleSub.replace("{naira}", exampleNaira)}
        value={<Price minor={EXAMPLE_NIGHT_MINOR} locale={locale} mode="full" guide="below" display={display} copy={copy} />}
        testId="setting-currency-example"
      />
      <Sheet open={open} onClose={() => setOpen(false)} title={copy.sheetTitle}>
        <CurrencyChoices intro={copy.sheetIntro} legend={copy.sheetTitle} options={options} choice={choice} onChoose={choose} />
      </Sheet>
    </>
  );
}

/**
 * The sheet's body: the plain words first, then the choices as native radio
 * buttons in one group, so a keyboard has one tab stop and the arrow keys.
 */
export function CurrencyChoices({
  intro,
  legend,
  options,
  choice,
  onChoose,
}: {
  intro: string;
  legend: string;
  options: { value: CurrencyChoice; label: string; sub: string }[];
  choice: CurrencyChoice;
  onChoose: (next: CurrencyChoice) => void;
}) {
  return (
    <>
      <p className="nf-body-sm mb-inline text-[var(--nf-content-muted)]">{intro}</p>
      <fieldset className="m-0 border-0 p-0" data-testid="currency-choices">
        <legend className="sr-only">{legend}</legend>
        {options.map((option) => (
          <label key={option.value} className="nf-srow cursor-pointer" data-currency={option.value}>
            <input
              type="radio"
              name="display-currency"
              value={option.value}
              checked={choice === option.value}
              onChange={() => onChoose(option.value)}
            />
            <span className="nf-srow__body">
              <span className="nf-srow__label">{option.label}</span>
              <span className="nf-srow__sub">{option.sub}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </>
  );
}

/** The sheet's options: Automatic (with what it picks now), then every currency. */
export function currencyOptions(
  copy: Pick<PreferencesCopy, "automatic" | "automaticSub" | "nairaSub">,
  automatic: DisplayCurrency,
): { value: CurrencyChoice; label: string; sub: string }[] {
  return [
    { value: AUTO_CURRENCY, label: copy.automatic, sub: copy.automaticSub.replace("{currency}", currencyLabel(automatic)) },
    ...DISPLAY_CURRENCIES.map((code: DisplayCurrency) => ({
      value: code,
      label: currencyLabel(code),
      sub: code === "NGN" ? copy.nairaSub : CURRENCY_META[code].symbol,
    })),
  ];
}

export function AreaRow({
  display,
  copy,
}: {
  display: DisplayMoney;
  copy: PreferencesCopy;
}) {
  const router = useRouter();
  const [unit, setUnit] = useState<AreaUnit>(display.areaUnit);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [served, setServed] = useState<AreaUnit>(display.areaUnit);
  if (served !== display.areaUnit) {
    setServed(display.areaUnit);
    setUnit(display.areaUnit);
  }

  const change = (next: AreaUnit) => {
    if (next === unit) return;
    const previous = unit;
    setUnit(next);
    setError(null);
    startTransition(async () => {
      const result = await saveDisplayPreferences({ areaUnit: next }).catch(() => null);
      if (!result) {
        setUnit(previous);
        setError(copy.saveFailed);
        return;
      }
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  const example = copy.areaExample.replace(
    "{area}",
    formatArea(EXAMPLE_AREA_SQM, unit, { sqm: copy.sqmShort, sqft: copy.sqftShort }),
  );

  return (
    <RowSegment<AreaUnit>
      icon="grid"
      label={copy.area}
      sub={error ?? `${copy.areaSub} ${example}`}
      value={unit}
      options={[
        { value: "sqm", label: copy.areaSqm },
        { value: "sqft", label: copy.areaSqft },
      ]}
      onChange={change}
    />
  );
}
