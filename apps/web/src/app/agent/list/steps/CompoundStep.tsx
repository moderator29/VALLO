"use client";

import type { Dictionary } from "@vallo/i18n/core";
import { ServiceQuestions } from "@/components/agent/ServiceQuestions";
import { FloodQuestion } from "@/components/agent/FloodQuestion";
import { CompoundQuestions } from "@/components/agent/CompoundQuestions";
import { parseNairaToKobo } from "@/lib/agent/listings-model";
import type { StepCtx } from "./context";

/**
 * THE COMPOUND: what the service charge covers (V-68), the flooding question
 * (V-41, behind its fail-closed flag) and the compound's homes (V-28). What
 * the charge covers is asked only where a charge is stated on a home to let
 * or sell; the gate question always is.
 */
export function CompoundStep({
  ctx,
  serviceCopy,
  floodCopy,
  compoundCopy,
  floodOpen,
}: {
  ctx: StepCtx;
  serviceCopy: Dictionary["shape"]["service"];
  floodCopy: Dictionary["shape"]["neighbours"];
  compoundCopy: Dictionary["shape"]["compound"];
  floodOpen: boolean;
}) {
  const { values, set, errors, asks, money } = ctx;
  return (
    <>
      <ServiceQuestions
        copy={serviceCopy}
        value={values.service}
        onChange={(next) => set("service", next)}
        chargeMinor={money.tenancy || money.forSale ? parseNairaToKobo(values.serviceChargeNaira) : null}
      />
      {floodOpen ? (
        <FloodQuestion copy={floodCopy} value={values.flooding} onChange={(next) => set("flooding", next)} />
      ) : null}
      {asks("compound") ? (
        <CompoundQuestions
          copy={compoundCopy}
          value={values.compound}
          onChange={(next) => set("compound", next)}
          flatsError={errors.flatsInCompound}
        />
      ) : null}
    </>
  );
}
