"use client";

import type { Dictionary } from "@vallo/i18n/core";
import { Segmented } from "@/components/ui/Segmented";
import type { Flooding } from "@/lib/around/pulse";

/**
 * The lister's flooding answer (V-41): in heavy rain, does water cut off the
 * road or enter the compound? Optional; unanswered renders on the listing as
 * "The lister has not said", never as good news, and residents' reports sit
 * beside whatever is answered.
 */
export function FloodQuestion({
  copy,
  value,
  onChange,
}: {
  copy: Dictionary["shape"]["neighbours"];
  value: Flooding | "";
  onChange: (next: Flooding | "") => void;
}) {
  return (
    <fieldset className="nf-panel nf-panel--card block p-card" data-testid="wizard-flood">
      <legend className="sr-only">{copy.wizardTitle}</legend>
      <p className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
        {copy.wizardTitle}
      </p>
      <p className="nf-body-sm mt-inline-tight leading-relaxed text-[var(--nf-content-muted)]">{copy.wizardHint}</p>
      <p className="nf-label mb-inline mt-group">{copy.wizardLabel}</p>
      <Segmented
        options={[
          { value: "" as const, label: copy.unanswered },
          { value: "none" as const, label: copy.choices.flood.none },
          { value: "road" as const, label: copy.choices.flood.road },
          { value: "compound" as const, label: copy.choices.flood.compound },
        ]}
        value={value}
        onChange={(next) => onChange(next)}
        semantics="radio"
        full
        stack
        label={copy.wizardLabel}
      />
    </fieldset>
  );
}
