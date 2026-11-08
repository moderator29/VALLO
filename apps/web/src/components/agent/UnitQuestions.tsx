"use client";

import type { Dictionary } from "@vallo/i18n/core";
import { Segmented } from "@/components/ui/Segmented";
import { UNIT_SHAPES, inferShape, type UnitForm, type UnitShape } from "@/lib/listings/unit-shape";
import "@/app/css/catalogue.css";
import { FieldProblem } from "@/components/ui/FieldProblem";

/**
 * WHAT SHAPE IS IT, in the listing wizard's first step (V-66).
 *
 * The shape from the market's own list, how many bedrooms are en-suite, and
 * whether a boys' quarters comes with it. The shape is required at submit for
 * a home to let or sell; the other two are optional and unanswered renders as
 * nothing. From the bedrooms the wizard SUGGESTS a shape (none is a
 * self-contain, one a mini flat) and asks the lister to confirm it with a
 * tap; it never fills the answer in on their behalf.
 */
export function UnitQuestions({
  copy,
  value,
  bedrooms,
  error,
  onChange,
}: {
  copy: Dictionary["shape"]["unit"];
  value: UnitForm;
  bedrooms: number;
  error?: string | undefined;
  onChange: (next: UnitForm) => void;
}) {
  const suggested = value.shape === "" ? inferShape(bedrooms) : null;
  const pick = (shape: UnitShape) => onChange({ ...value, shape: value.shape === shape ? "" : shape });

  return (
    <fieldset className="nf-panel nf-panel--card block p-card" data-testid="wizard-unit">
      <legend className="sr-only">{copy.wizardTitle}</legend>
      <p className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
        {copy.wizardTitle}
      </p>
      <p className="nf-body-sm mt-inline-tight leading-relaxed text-[var(--nf-content-muted)]">{copy.wizardHint}</p>
      {suggested && (
        <p className="nf-body-sm mt-inline-tight text-[var(--nf-content-secondary)]" data-testid="wizard-unit-suggested">
          {copy.wizardInferred.replace("{shape}", copy.shapes[suggested].toLowerCase())}
        </p>
      )}

      <div className="mt-group flex flex-wrap gap-xs" role="group" aria-label={copy.wizardTitle}>
        {UNIT_SHAPES.map((shape) => (
          <button
            key={shape}
            type="button"
            aria-pressed={value.shape === shape}
            data-testid={`wizard-unit-${shape}`}
            onClick={() => pick(shape)}
            className={`nf-filters__tile min-w-11 ${suggested === shape ? "border-[var(--nf-border-strong)]" : ""}`}
          >
            {copy.shapes[shape]}
          </button>
        ))}
      </div>
      {/* The step's problem is said by the one banner (founder, 7 November 2026). */}
      <FieldProblem id="wizard-unit-problem" message={error} />

      <div className="mt-group space-y-group">
        {bedrooms > 0 && (
          <label className="block">
            <span className="nf-label mb-inline block">{copy.ensuiteLabel}</span>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={value.ensuite}
              placeholder={copy.unanswered}
              onChange={(event) => onChange({ ...value, ensuite: event.target.value.replace(/[^0-9]/g, "").slice(0, 2) })}
              className="nf-field"
              data-testid="wizard-unit-ensuite"
            />
          </label>
        )}
        <div>
          <p className="nf-label mb-inline">{copy.bqLabel}</p>
          <Segmented
            options={[
              { value: "" as const, label: copy.unanswered },
              { value: "yes" as const, label: copy.yes },
              { value: "no" as const, label: copy.no },
            ]}
            value={value.bq}
            onChange={(next) => onChange({ ...value, bq: next })}
            semantics="radio"
            full
            label={copy.bqLabel}
          />
        </div>
      </div>
    </fieldset>
  );
}
