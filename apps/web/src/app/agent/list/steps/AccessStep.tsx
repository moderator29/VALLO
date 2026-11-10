"use client";

import {
  MAX_ACCESS_CODE,
  MAX_ESTATE_NAME,
  MAX_GATE_DIRECTIONS,
  MAX_SECURITY_PHONE,
} from "@/lib/agent/listings-model";
import { Field, Note } from "./parts";
import { WIZARD_WORDS } from "./copy";
import type { StepCtx } from "./context";

const W = WIZARD_WORDS.access;

/**
 * ACCESS: how somebody gets through the gate. Written to its own table, which
 * the public page cannot read, and released only to a guest whose booking is
 * confirmed (`setListingAccess`).
 */
export function AccessStep({ ctx }: { ctx: StepCtx }) {
  const { values, set, errors } = ctx;
  return (
    <>
      <Note glyph="lock">
        <span className="block font-semibold">{W.panelTitle}</span>
        <span className="block">{W.panelBody}</span>
      </Note>
      <Field label={W.estateName} error={errors.estateName}>
        <input
          className="nf-field"
          value={values.estateName}
          maxLength={MAX_ESTATE_NAME}
          onChange={(e) => set("estateName", e.target.value)}
          placeholder="Alagomeji Court"
        />
      </Field>
      <Field label={W.gateDirections} hint={W.gateDirectionsHint} error={errors.gateDirections}>
        <textarea
          className="nf-field min-h-[84px] resize-y"
          value={values.gateDirections}
          maxLength={MAX_GATE_DIRECTIONS}
          onChange={(e) => set("gateDirections", e.target.value)}
          placeholder="Second gate off Herbert Macaulay. Tell security you are visiting flat 4B."
        />
      </Field>
      <Field label={W.securityPhone} error={errors.securityPhone}>
        <input
          className="nf-field"
          inputMode="tel"
          value={values.securityPhone}
          maxLength={MAX_SECURITY_PHONE}
          onChange={(e) => set("securityPhone", e.target.value)}
          placeholder="0803 000 0000"
        />
      </Field>
      <Field label={W.accessCode} error={errors.accessCode}>
        <input
          className="nf-field"
          value={values.accessCode}
          maxLength={MAX_ACCESS_CODE}
          onChange={(e) => set("accessCode", e.target.value)}
          placeholder="4471"
        />
      </Field>
    </>
  );
}
