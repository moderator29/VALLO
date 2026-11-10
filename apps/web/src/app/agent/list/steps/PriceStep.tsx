"use client";

import type { ReactNode } from "react";
import { formatMoney } from "@vallo/i18n/core";
import { NairaField } from "@/components/ui/NairaField";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { RENT_PERIOD_CHOICES, type RentPeriod } from "@/lib/agent/listings-model";
import { fill } from "../../_copy";
import { WIZARD_WORDS } from "./copy";
import type { StepCtx } from "./context";

const W = WIZARD_WORDS.price;

/**
 * PRICING (R18.8): one large naira figure, in the shape this market quotes
 * it. A rent with how often it is paid, an asking price, or a nightly (or
 * per head) rate. What is paid on top is the next question, not this one.
 * The guide (V-74) says what similar homes nearby are asking.
 */
export function PriceStep({ ctx, guide }: { ctx: StepCtx; guide?: ReactNode }) {
  const { values, set, copy, errors, mark, money, locale } = ctx;
  if (money.forSale) {
    return (
      <>
        <NairaField
          label={W.salePrice}
          value={values.salePriceNaira}
          onValueChange={(v) => set("salePriceNaira", v)}
          allowKobo
          error={errors.salePrice ?? errors.salePriceNaira}
          hint={money.saleMinor > 0 ? `${formatMoney(money.saleMinor, locale)} ${copy.pricing.period.sale}` : copy.pricing.priceHint}
          placeholder="180,000,000"
          data-testid="price-sale"
        />
        {mark("salePriceNaira")}
        {guide}
        <Switch
          label={W.priceNegotiable}
          description={W.priceNegotiableBody}
          checked={values.priceNegotiable}
          onCheckedChange={(v) => set("priceNegotiable", v)}
        />
        {mark("priceNegotiable")}
      </>
    );
  }
  if (money.tenancy) {
    return (
      <>
        <NairaField
          label={W.rent}
          value={values.rentNaira}
          onValueChange={(v) => set("rentNaira", v)}
          allowKobo
          error={errors.rent ?? errors.rentNaira}
          hint={
            money.rentMinor > 0
              ? `${formatMoney(money.rentMinor, locale)} ${copy.pricing.period[values.rentPeriod]}`
              : copy.pricing.priceHint
          }
          placeholder="4,500,000"
          data-testid="price-rent"
        />
        {mark("rentNaira")}
        <div>
          <p className="nf-label mb-inline">
            {W.howOften}
            {mark("rentPeriod", "rentNegotiable")}
          </p>
          <Segmented<RentPeriod>
            semantics="radio"
            full
            label={W.howOften}
            value={values.rentPeriod}
            onChange={(v) => set("rentPeriod", v)}
            options={RENT_PERIOD_CHOICES.map((c) => ({ value: c.value, label: c.label }))}
          />
        </div>
        {guide}
        <Switch
          label={W.rentNegotiable}
          description={W.rentNegotiableBody}
          checked={values.rentNegotiable}
          onCheckedChange={(v) => set("rentNegotiable", v)}
        />
        <p className="text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
          {copy.pricing.rentalNote}
        </p>
      </>
    );
  }
  return (
    <>
      <NairaField
        label={money.perHead ? W.head : copy.pricing.priceNightLabel}
        value={values.rateNaira}
        onValueChange={(v) => set("rateNaira", v)}
        allowKobo
        error={errors.rate ?? errors.rateNaira}
        hint={
          money.rateMinor > 0
            ? fill(copy.pricing.priceWithPeriod, {
                price: formatMoney(money.rateMinor, locale),
                period: money.perHead ? copy.pricing.period.guest : copy.pricing.perNight,
              })
            : copy.pricing.priceHint
        }
        placeholder={copy.pricing.priceNightPlaceholder}
        data-testid="price-rate"
      />
      {mark("rateNaira")}
    </>
  );
}
