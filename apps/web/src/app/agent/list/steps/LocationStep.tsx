"use client";

import { Field, Note } from "./parts";
import { WIZARD_WORDS } from "./copy";
import type { StepCtx } from "./context";

const W = WIZARD_WORDS.location;

/**
 * LOCATION: "Where is the property?" (R18.5), with the privacy said at the
 * moment of asking (pattern 13): searchers see the area, the street address
 * only once a booking is confirmed.
 */
export function LocationStep({ ctx, states }: { ctx: StepCtx; states: { code: string; name: string }[] }) {
  const { values, set, copy, errors, mark } = ctx;
  return (
    <>
      <Field fromMessage={mark("stateCode")} label={copy.location.stateLabel} error={errors.stateCode}>
        <select className="nf-field" value={values.stateCode} onChange={(e) => set("stateCode", e.target.value)}>
          <option value="">{copy.location.statePlaceholder}</option>
          {states.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field fromMessage={mark("city")} label={copy.location.cityLabel} error={errors.city}>
        <input
          className="nf-field"
          value={values.city}
          onChange={(e) => set("city", e.target.value)}
          placeholder={copy.location.cityPlaceholder}
        />
      </Field>
      <Field fromMessage={mark("area")} label={copy.location.areaLabel} error={errors.area} hint={copy.location.areaHint}>
        <input
          className="nf-field"
          value={values.area}
          onChange={(e) => set("area", e.target.value)}
          placeholder={copy.location.areaPlaceholder}
        />
      </Field>
      <Field label={copy.location.addressLabel} hint={copy.location.addressHint} error={errors.address}>
        <input
          className="nf-field"
          value={values.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder={copy.location.addressPlaceholder}
        />
      </Field>
      <Field label={copy.location.landmarkLabel} hint={copy.location.landmarkHint} error={errors.landmark}>
        <input
          className="nf-field"
          value={values.landmark}
          onChange={(e) => set("landmark", e.target.value)}
          placeholder={copy.location.landmarkPlaceholder}
        />
      </Field>
      <div className="nf-lw2-privacy" data-testid="location-privacy">
        <Note glyph="lock">
          <span className="block font-semibold">{W.privacyTitle}</span>
          <span className="block">{W.privacyBody}</span>
        </Note>
      </div>
    </>
  );
}
