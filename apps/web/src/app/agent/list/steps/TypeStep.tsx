"use client";

import { Choice, Note, TYPE_ART, TYPE_OBJECT, TYPE_REALISTIC } from "./parts";
import type { StepCtx } from "./context";
import { typesFor } from "./model";

/**
 * "Which best describes it?" (R18.4): the property types the chosen kind can
 * have, as a tile grid of objects over one word. The chosen type's meaning
 * sits in the calm panel under the grid, which is where the reader needs it:
 * after choosing, not before.
 */
export function TypeStep({ ctx }: { ctx: StepCtx }) {
  const { values, set, copy } = ctx;
  return (
    <>
      <div className="nf-lw-choices nf-lw-choices--3" role="group" aria-label={copy.basics.propertyTypeLabel}>
        {typesFor(ctx.kind, values.propertyType).map((type) => (
          <Choice
            key={type}
            centred
            name={copy.propertyTypes[type].label}
            object={TYPE_OBJECT[type]}
            art={TYPE_ART[type]}
            realistic={TYPE_REALISTIC[type]}
            chosen={values.propertyType === type}
            onClick={() => set("propertyType", type)}
          />
        ))}
      </div>
      {ctx.mark("propertyType")}
      <Note glyph="info">{copy.propertyTypes[values.propertyType].blurb}</Note>
      {ctx.kind === "rent" ? <Note>{copy.basics.rentalNote}</Note> : null}
    </>
  );
}
