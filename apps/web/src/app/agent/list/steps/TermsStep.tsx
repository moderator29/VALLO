"use client";

import { UiIcon } from "@/design-system/icons/UiIcon";
import { FieldProblem } from "@/components/ui/FieldProblem";
import { SALE_STATUS_CHOICES, TENURE_CHOICES } from "@/lib/agent/listings-model";
import { feedback } from "@/lib/ui/feedback";
import { Field } from "./parts";
import { digitsOnly } from "./model";
import { WIZARD_WORDS } from "./copy";
import type { StepCtx } from "./context";

const W = WIZARD_WORDS.terms;

/**
 * TERMS: the market's own conditions. A tenancy's shortest term and its first
 * free day; a sale's title (required by the submit gate, because a property
 * for sale with no stated title is the shape of every land scam), where the
 * sale stands and the year built; a stay's first free day.
 */
export function TermsStep({ ctx }: { ctx: StepCtx }) {
  const { values, set, errors, money } = ctx;
  const available = (
    <Field label={W.availableFrom} hint={money.tenancy ? undefined : WIZARD_WORDS.terms.subtitleStay} error={errors.availableFrom}>
      <input
        className="nf-field"
        type="date"
        value={values.availableFrom}
        onChange={(e) => set("availableFrom", e.target.value)}
      />
    </Field>
  );
  if (money.forSale) {
    return (
      <>
        <fieldset>
          <legend className="nf-label mb-inline">{W.tenure}</legend>
          <div className="flex flex-wrap gap-inline">
            {TENURE_CHOICES.map((choice) => (
              <button
                key={choice.value}
                type="button"
                className="nf-chip min-h-11"
                aria-pressed={values.tenure === choice.value}
                onClick={() => {
                  feedback("select");
                  set("tenure", values.tenure === choice.value ? "" : choice.value);
                }}
              >
                {values.tenure === choice.value && <UiIcon name="verified" size={16} />}
                {choice.label}
              </button>
            ))}
          </div>
          <p className="nf-body-sm mt-inline text-[var(--nf-content-muted)]">
            {TENURE_CHOICES.find((c) => c.value === values.tenure)?.blurb ?? W.tenureAsk}
          </p>
          <FieldProblem id="wizard-tenure-problem" message={errors.tenure} />
        </fieldset>
        <fieldset>
          <legend className="nf-label mb-inline">{W.saleStatus}</legend>
          <div className="flex flex-wrap gap-inline">
            {SALE_STATUS_CHOICES.map((choice) => (
              <button
                key={choice.value}
                type="button"
                className="nf-chip min-h-11"
                aria-pressed={values.saleStatus === choice.value}
                onClick={() => {
                  feedback("select");
                  set("saleStatus", choice.value);
                }}
              >
                {values.saleStatus === choice.value && <UiIcon name="verified" size={16} />}
                {choice.label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 items-end gap-row">
          <Field label={W.yearBuilt} error={errors.yearBuilt}>
            <input
              className="nf-field"
              inputMode="numeric"
              value={values.yearBuilt}
              onChange={(e) => set("yearBuilt", digitsOnly(e.target.value, 4))}
              placeholder="2019"
            />
          </Field>
        </div>
        {available}
      </>
    );
  }
  if (money.tenancy) {
    return (
      <>
        <Field label={W.shortestTenancy} error={errors.minimumTenancyMonths}>
          <input
            className="nf-field"
            inputMode="numeric"
            value={values.minimumTenancyMonths}
            onChange={(e) => set("minimumTenancyMonths", digitsOnly(e.target.value, 3))}
            placeholder="12"
          />
        </Field>
        {available}
      </>
    );
  }
  return available;
}
