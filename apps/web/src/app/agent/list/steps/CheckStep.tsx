"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { countOf, formatDate, formatMoney } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import {
  CONDITION_CHOICES,
  FURNISHING_CHOICES,
  POWER_GRID_CHOICES,
  RECOMMENDED_MEDIA,
  SALE_STATUS_CHOICES,
  TENURE_CHOICES,
  WATER_SUPPLY_CHOICES,
  countWords,
} from "@/lib/agent/listings-model";
import { EMPTY_COMPOUND_FORM } from "@/lib/listings/compound";
import { EMPTY_SERVICE_FORM } from "@/lib/listings/service";
import { fill } from "../../_copy";
import { WIZARD_WORDS } from "./copy";
import type { StepCtx } from "./context";
import { RENT_CHARGE_KEYS, SALE_CHARGE_KEYS, type Media, type StepDef, type StepId } from "./model";

const W = WIZARD_WORDS.check;

/** One line of "things to fix": what, why, and where it is fixed. */
export type Fix = {
  key: string;
  label: string;
  detail?: string;
  /** The step that fixes it, for a Fix pill. */
  step?: StepId;
  /** Or a page outside the flow (identity verification). */
  href?: string;
  hrefLabel?: string;
  testId?: string;
};

/**
 * CHECK YOUR LISTING (R18.12, R28, pattern 16): the review page is the
 * checklist. Under the card as a searcher will see it (drawn by the wizard,
 * so it is the same element once the listing is sent): every answer,
 * with a Change pill that goes to the step that owns it (and one tap back
 * here); and the THINGS TO FIX, each with its own way to the fix, including
 * the one that is not in the flow at all: verifying your identity, which
 * links straight to /verification.
 *
 * The verdict of what is unmet stays the submit gate's (`submitRequirements`,
 * worked out in the wizard); this page only says it.
 */
export function CheckStep({
  ctx,
  steps,
  media,
  amenityCount,
  stateName,
  doorDeclared,
  fixes,
  after,
  busy,
  onChange,
}: {
  ctx: StepCtx;
  steps: readonly StepDef[];
  media: Media[];
  amenityCount: number;
  stateName: string;
  /** A stay's charges at the door: true declared, false not yet, null unknown or not a stay. */
  doorDeclared: boolean | null;
  fixes: Fix[];
  /** What follows the answers: demand, the fee screen, the gates after a refusal. */
  after: ReactNode;
  busy: boolean;
  onChange: (step: StepId) => void;
}) {
  const { values, copy, money, locale, kind } = ctx;
  const notSet = null;
  const priceText =
    money.priceMinor > 0
      ? `${formatMoney(money.priceMinor, locale)} ${
          money.forSale
            ? copy.pricing.period.sale
            : money.tenancy
              ? copy.pricing.period[values.rentPeriod]
              : money.perHead
                ? copy.pricing.period.guest
                : copy.pricing.period.night
        }`
      : notSet;
  const chargeKeys = money.forSale ? SALE_CHARGE_KEYS : RENT_CHARGE_KEYS;
  const declaredCharges = chargeKeys.filter((key) => values[key].trim() !== "").length;
  const availableFrom = (() => {
    const [year, month, day] = values.availableFrom.split("-").map(Number);
    if (!year || !month || !day) return null;
    return formatDate(new Date(Date.UTC(year, month - 1, day, 12)), locale);
  })();

  const summary: Partial<Record<StepId, string | null>> = {
    kind: W.kinds[kind],
    type: copy.propertyTypes[values.propertyType]?.label ?? notSet,
    location: [values.area, values.city, stateName].filter(Boolean).join(", ") || notSet,
    rooms:
      [
        ctx.asks("bedrooms") ? `${values.bedrooms} ${copy.drawn.checkOver.keys.bedrooms.toLocaleLowerCase(locale)}` : null,
        ctx.asks("bathrooms") ? `${values.bathrooms} ${copy.drawn.checkOver.keys.bathrooms.toLocaleLowerCase(locale)}` : null,
        values.toilets ? `${values.toilets} ${copy.drawn.rooms.toilets.toLocaleLowerCase(locale)}` : null,
        values.sizeSqm ? `${values.sizeSqm} m²` : null,
      ]
        .filter(Boolean)
        .join(", ") || notSet,
    place:
      [
        FURNISHING_CHOICES.find((c) => c.value === values.furnished)?.label,
        values.floor ? `${copy.drawn.rooms.floor} ${values.floor}` : null,
        CONDITION_CHOICES.find((c) => c.value === values.condition)?.label,
      ]
        .filter(Boolean)
        .join(", ") || notSet,
    supply:
      [
        POWER_GRID_CHOICES.find((c) => c.value === values.powerGrid)?.label,
        WATER_SUPPLY_CHOICES.find((c) => c.value === values.waterSupply)?.label,
      ]
        .filter(Boolean)
        .join(", ") || notSet,
    compound:
      JSON.stringify(values.service) !== JSON.stringify(EMPTY_SERVICE_FORM) ||
      JSON.stringify(values.compound) !== JSON.stringify(EMPTY_COMPOUND_FORM) ||
      values.flooding !== ""
        ? W.answered
        : notSet,
    access: [values.estateName, values.gateDirections, values.securityPhone, values.accessCode].some((v) => v.trim() !== "")
      ? W.accessSet
      : notSet,
    amenities: amenityCount === 0 ? notSet : fill(copy.drawn.checkOver.amenitiesCount, { count: amenityCount }),
    price: priceText,
    charges: money.shortStay
      ? doorDeclared === null
        ? notSet
        : doorDeclared
          ? W.doorDeclared
          : W.doorOpen
      : declaredCharges > 0
        ? fill(W.chargesCount, { count: declaredCharges })
        : W.chargesNone,
    terms: money.forSale
      ? [
          TENURE_CHOICES.find((c) => c.value === values.tenure)?.label,
          SALE_STATUS_CHOICES.find((c) => c.value === values.saleStatus)?.label,
        ]
          .filter(Boolean)
          .join(", ") || notSet
      : [values.minimumTenancyMonths && money.tenancy ? countOf(Number(values.minimumTenancyMonths), "months", locale) : null, availableFrom ?? copy.drawn.checkOver.availableNow]
          .filter(Boolean)
          .join(", "),
    photos: media.length === 0 ? notSet : fill(W.photosLine, { count: media.length, recommended: RECOMMENDED_MEDIA }),
    describe: values.title.trim() ? `${values.title.trim()}. ${fill(W.words, { count: countWords(values.description) })}` : notSet,
  };

  return (
    <>
      <section aria-labelledby="check-fix-title" className={fixes.length > 0 ? "nf-g1-fix" : "nf-lw2-ready"} data-ready={fixes.length === 0 ? "" : undefined}>
        <h2 id="check-fix-title" className={fixes.length > 0 ? "nf-g1-fix__title" : "nf-lw2-ready__title"} data-testid="send-title">
          {fixes.length === 0 ? W.readyTitle : fixes.length === 1 ? W.fixTitleOne : fill(W.fixTitleMany, { count: fixes.length })}
        </h2>
        {fixes.length === 0 ? (
          <p className="nf-body-sm text-[var(--nf-content-secondary)]">{W.readyBody}</p>
        ) : (
          <ul className="nf-lw2-fixes">
            {fixes.map((fix) => (
              <li key={fix.key} className="nf-lw2-fix" data-testid={fix.testId ?? `send-check-${fix.key}`}>
                <span className="nf-lw2-fix__mark" aria-hidden="true">
                  <UiIcon name="info" size={12} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="nf-lw2-fix__label">{fix.label}</span>
                  {fix.detail ? <span className="nf-lw2-fix__detail">{fix.detail}</span> : null}
                </span>
                {fix.href ? (
                  <Link href={fix.href} className="nf-g1-change" aria-label={`${fix.hrefLabel ?? W.fix}: ${fix.label}`}>
                    {fix.hrefLabel ?? W.fix}
                    <UiIcon name="chevron-right" size={12} />
                  </Link>
                ) : fix.step ? (
                  <button
                    type="button"
                    className="nf-g1-change"
                    disabled={busy}
                    onClick={() => onChange(fix.step!)}
                    aria-label={`${W.fix}: ${fix.label}`}
                  >
                    {W.fix}
                    <UiIcon name="chevron-right" size={12} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="check-answers-title">
        <h2 id="check-answers-title" className="nf-label">
          {W.answersTitle}
        </h2>
        <ul className="nf-lw2-answers" data-testid="check-answers">
          {steps
            .filter((step) => step.id !== "check")
            .map((step) => {
              const value = summary[step.id];
              const label = W.rows[step.id as keyof typeof W.rows];
              return (
                <li key={step.id} className="nf-lw2-answer" data-testid={`check-row-${step.id}`}>
                  <span className="min-w-0 flex-1">
                    <span className="nf-lw2-answer__key">{label}</span>
                    <span className="nf-lw2-answer__value" data-unset={value ? undefined : ""}>
                      {value ?? W.notSet}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="nf-g1-change"
                    disabled={busy}
                    onClick={() => onChange(step.id)}
                    aria-label={`${W.change}: ${label}`}
                  >
                    {W.change}
                    <UiIcon name="chevron-right" size={12} />
                  </button>
                </li>
              );
            })}
        </ul>
        <p className="nf-body-sm mt-row text-[var(--nf-content-muted)]">{W.optionalLater}</p>
      </section>

      {after}
    </>
  );
}
