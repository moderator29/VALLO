"use client";

import { FieldProblem } from "@/components/ui/FieldProblem";
import { fill } from "../../_copy";
import { NumberChips } from "./parts";
import { WIZARD_WORDS } from "./copy";
import type { StepCtx } from "./context";

const W = WIZARD_WORDS.rooms;

/**
 * DETAILS: "How many rooms does it have?" (R18.7, R32). Each count is a row
 * of number chips, one tap for the usual answers and an exact stepper past
 * nine. Only the facts this type can have are asked (`asksFact`): a shop has
 * no bedrooms, a plot has only its size.
 */
export function RoomsStep({ ctx }: { ctx: StepCtx }) {
  const { values, set, copy, errors, asks, mark, counterAria } = ctx;
  const rooms = copy.drawn.rooms;
  const chips = (label: string) => ({
    moreLabel: fill(W.more, { n: 9 }),
    fewerLabel: counterAria("fewer", label),
    moreAria: counterAria("more", label),
  });
  const optionalCount = (raw: string) => (raw.trim() === "" ? null : Number(raw) || 0);
  return (
    <>
      {asks("bedrooms") ? (
        <NumberChips
          label={copy.basics.counters.bedrooms}
          value={values.bedrooms}
          onChange={(n) => set("bedrooms", n ?? 0)}
          fromMessage={mark("bedrooms")}
          testId="rooms-bedrooms"
          {...chips(copy.basics.counters.bedrooms)}
        />
      ) : null}
      {asks("bathrooms") ? (
        <NumberChips
          label={copy.basics.counters.bathrooms}
          value={values.bathrooms}
          onChange={(n) => set("bathrooms", n ?? 0)}
          fromMessage={mark("bathrooms")}
          testId="rooms-bathrooms"
          {...chips(copy.basics.counters.bathrooms)}
        />
      ) : null}
      {asks("toilets") ? (
        <NumberChips
          label={rooms.toilets}
          optional={rooms.optional}
          value={optionalCount(values.toilets)}
          onChange={(n) => set("toilets", n === null || n === 0 ? "" : String(n))}
          fromMessage={mark("toilets")}
          {...chips(rooms.toilets)}
        />
      ) : null}
      {asks("parking") ? (
        <NumberChips
          label={rooms.parking}
          optional={rooms.optional}
          value={optionalCount(values.parkingSpaces)}
          onChange={(n) => set("parkingSpaces", n === null || n === 0 ? "" : String(n))}
          fromMessage={mark("parkingSpaces")}
          {...chips(rooms.parking)}
        />
      ) : null}
      <label className="block">
        <span className="nf-lw2-count__head">
          <span className="nf-label">{rooms.size}</span>
          <span className="nf-lw2-count__optional">{rooms.optional}</span>
        </span>
        <span className="nf-lw2-suffixed">
          <input
            className="nf-field"
            inputMode="decimal"
            value={values.sizeSqm}
            onChange={(e) => set("sizeSqm", e.target.value.replace(/[^0-9.]/g, "").slice(0, 10))}
            placeholder="150"
          />
          <span className="nf-lw2-suffixed__unit" aria-hidden="true">
            m²
          </span>
        </span>
        <span className="nf-body-sm mt-inline-tight block text-[var(--nf-content-muted)]">
          {values.propertyType === "land" ? W.subtitleLand : rooms.sizeAsk}
        </span>
        <FieldProblem id="wizard-sizeSqm-problem" message={errors.sizeSqm} />
      </label>
    </>
  );
}
