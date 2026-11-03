"use client";

import { useId } from "react";
import { Button } from "@/components/ui/Button";
import type { Dictionary } from "@vallo/i18n/core";
import { Segmented } from "@/components/ui/Segmented";
import {
  SERVICE_COVERS,
  isServiced,
  type EstateType,
  type ServiceCover,
  type ServiceForm,
} from "@/lib/listings/service";
import "@/app/css/catalogue.css";

/**
 * THE SERVICE CHARGE AND THE GATE, in the listing wizard (V-68).
 *
 * What the service charge pays for (a multi-select over a fixed list), whether
 * it is a fixed sum or estimated and balanced at year end, and what kind of
 * gate the home is behind. The lister never types the word Serviced: the line
 * under the chips says whether these answers earn it, because the database
 * derives it from the same three covers (`is_serviced`).
 *
 * Every question is optional. The covers start unanswered, and the first tap
 * makes an empty list a real answer ("covers none of these") rather than
 * silence. Tiles are the drawer's own `nf-filters__tile` toggles, pressed state
 * in words and in `aria-pressed`, never colour alone.
 */
export function ServiceQuestions({
  copy,
  value,
  onChange,
  chargeMinor,
}: {
  copy: Dictionary["shape"]["service"];
  value: ServiceForm;
  onChange: (next: ServiceForm) => void;
  /** The service charge stated in the pricing step; Serviced needs one. */
  chargeMinor: number | null;
}) {
  const id = useId();
  const toggle = (cover: ServiceCover) => {
    const covers = value.covers.includes(cover)
      ? value.covers.filter((c) => c !== cover)
      : SERVICE_COVERS.filter((c) => c === cover || value.covers.includes(c));
    onChange({ ...value, covers, coversAnswered: true });
  };
  const serviced = isServiced(value.covers, chargeMinor);

  return (
    <fieldset className="nf-panel nf-panel--card block p-card" data-testid="wizard-service">
      <legend className="sr-only">{copy.wizardTitle}</legend>
      <p className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
        {copy.wizardTitle}
      </p>
      <p className="nf-body-sm mt-inline-tight leading-relaxed text-[var(--nf-content-muted)]">
        {copy.wizardHint}
      </p>

      <div className="mt-group space-y-group">
        {chargeMinor !== null && chargeMinor > 0 ? (
          <>
            <div>
              <p className="nf-label mb-inline">{copy.coversLabel}</p>
              <div className="flex flex-wrap gap-xs">
                {SERVICE_COVERS.map((cover) => (
                  <button
                    key={cover}
                    type="button"
                    aria-pressed={value.covers.includes(cover)}
                    data-testid={`service-cover-${cover}`}
                    onClick={() => toggle(cover)}
                    className="nf-filters__tile min-w-11"
                  >
                    {copy.covers[cover]}
                  </button>
                ))}
              </div>
              {value.coversAnswered && (
                <>
                  <p className="nf-caption mt-inline text-[var(--nf-content-secondary)]" role="status">
                    {serviced ? `${copy.serviced}: ${copy.servicedMeaning}` : value.covers.length === 0 ? copy.coversNone : ""}
                  </p>
                  {/* Back to unanswered, which is not the same as "covers none". */}
                  <Button
                    variant="quiet"
                    size="sm"
                    data-testid="service-covers-unanswered"
                    onClick={() => onChange({ ...value, covers: [], coversAnswered: false })}
                    className="mt-inline"
                  >
                    {copy.unanswered}
                  </Button>
                </>
              )}
            </div>

            <div>
              <p className="nf-label mb-inline">{copy.reconciledLabel}</p>
              <Segmented
                options={[
                  { value: "" as const, label: copy.unanswered },
                  { value: "fixed" as const, label: copy.fixed },
                  { value: "reconciled" as const, label: copy.reconciled },
                ]}
                value={value.reconciled}
                onChange={(next) => onChange({ ...value, reconciled: next })}
                semantics="radio"
                full
                stack
                label={copy.reconciledLabel}
              />
            </div>
          </>
        ) : (
          <p className="nf-body-sm text-[var(--nf-content-muted)]" data-testid="wizard-service-needs-charge">
            {copy.needsCharge}
          </p>
        )}

        <div>
          <label htmlFor={`${id}-estate`} className="nf-label mb-inline block">
            {copy.estateLabel}
          </label>
          <select
            id={`${id}-estate`}
            className="nf-field"
            value={value.estateType}
            data-testid="service-estate"
            onChange={(e) => onChange({ ...value, estateType: e.target.value as EstateType | "" })}
          >
            <option value="">{copy.unanswered}</option>
            <option value="gated_estate">{copy.estateTypes.gated_estate}</option>
            <option value="gated_compound">{copy.estateTypes.gated_compound}</option>
            <option value="open_street">{copy.estateTypes.open_street}</option>
          </select>
        </div>
      </div>
    </fieldset>
  );
}
