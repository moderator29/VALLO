"use client";

import { useId } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Segmented } from "@/components/ui/Segmented";
import type { CompoundForm, ParkingType, WasteDisposal } from "@/lib/listings/compound";
import { FieldProblem } from "@/components/ui/FieldProblem";

/**
 * THE COMPOUND: five questions in the listing wizard (V-28).
 *
 * Where a car parks, how many homes share the compound, whether the landlord
 * lives there, how rubbish leaves, and whether a car can get in. They are the
 * questions a renter asks at the gate of every Lagos viewing, and a lister who
 * answers them here saves that renter a wasted trip across the city.
 *
 * EVERY ONE IS OPTIONAL AND "NOT ANSWERED" IS A REAL CHOICE. Each control
 * opens on it and can go back to it, because the product renders an
 * unanswered question as nothing at all and never as a no. Two of the answers
 * feed strict filters on the search drawer (landlord lives elsewhere, parking
 * inside), so a guess here would put a flat in front of somebody it does not
 * suit.
 *
 * A native select for the two three-way questions (they read cleanly at 390
 * and need no JavaScript to be usable), a segmented Yes/No for the two
 * yes-or-no ones, and a number for the count. No component is invented here:
 * the wizard's own `nf-field` and `nf-label` and the shared `Segmented`.
 */
export function CompoundQuestions({
  copy,
  value,
  onChange,
  flatsError,
}: {
  copy: Dictionary["shape"]["compound"];
  value: CompoundForm;
  onChange: (next: CompoundForm) => void;
  /** The schema's own sentence when the number is out of range. */
  flatsError?: string | undefined;
}) {
  const id = useId();
  const patch = (next: Partial<CompoundForm>) => onChange({ ...value, ...next });
  const yesNo = [
    { value: "" as const, label: copy.unanswered },
    { value: "yes" as const, label: copy.yes },
    { value: "no" as const, label: copy.no },
  ];

  return (
    <fieldset className="nf-panel nf-panel--card block p-card" data-testid="wizard-compound">
      <legend className="sr-only">{copy.title}</legend>
      <p className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
        {copy.title}
      </p>
      <p className="nf-body-sm mt-inline-tight leading-relaxed text-[var(--nf-content-muted)]">
        {copy.wizardHint}
      </p>

      <div className="mt-group space-y-group">
        <div>
          <label htmlFor={`${id}-parking`} className="nf-label mb-inline block">
            {copy.parkingLabel}
          </label>
          <select
            id={`${id}-parking`}
            className="nf-field"
            value={value.parkingType}
            data-testid="compound-parking"
            onChange={(e) => patch({ parkingType: e.target.value as ParkingType | "" })}
          >
            <option value="">{copy.unanswered}</option>
            <option value="inside">{copy.parkingOptionInside}</option>
            <option value="street">{copy.parkingOptionStreet}</option>
            <option value="none">{copy.parkingOptionNone}</option>
          </select>
        </div>

        <div>
          <label htmlFor={`${id}-flats`} className="nf-label mb-inline block">
            {copy.flatsLabel}
          </label>
          <input
            id={`${id}-flats`}
            className="nf-field"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            value={value.flatsInCompound}
            data-testid="compound-flats"
            onChange={(e) => patch({ flatsInCompound: e.target.value.replace(/[^0-9]/g, "").slice(0, 3) })}
            aria-invalid={flatsError ? true : undefined}
            aria-describedby={flatsError ? "compound-flats-problem" : undefined}
          />
          {/* The field keeps its red edge; the words go to the one banner (founder, 7 November 2026). */}
          <FieldProblem id="compound-flats-problem" message={flatsError} />
        </div>

        <div>
          <p className="nf-label mb-inline">{copy.landlordLabel}</p>
          <Segmented
            options={yesNo}
            value={value.landlordOnSite}
            onChange={(next) => patch({ landlordOnSite: next })}
            semantics="radio"
            full
            label={copy.landlordLabel}
          />
        </div>

        <div>
          <label htmlFor={`${id}-waste`} className="nf-label mb-inline block">
            {copy.wasteLabel}
          </label>
          <select
            id={`${id}-waste`}
            className="nf-field"
            value={value.wasteDisposal}
            data-testid="compound-waste"
            onChange={(e) => patch({ wasteDisposal: e.target.value as WasteDisposal | "" })}
          >
            <option value="">{copy.unanswered}</option>
            <option value="psp">{copy.wasteOptionPsp}</option>
            <option value="estate">{copy.wasteOptionEstate}</option>
            <option value="none">{copy.wasteOptionNone}</option>
          </select>
        </div>

        <div>
          <p className="nf-label mb-inline">{copy.carLabel}</p>
          <Segmented
            options={yesNo}
            value={value.carAccess}
            onChange={(next) => patch({ carAccess: next })}
            semantics="radio"
            full
            label={copy.carLabel}
          />
        </div>
      </div>
    </fieldset>
  );
}
