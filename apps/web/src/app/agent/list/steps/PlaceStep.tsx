"use client";

import { FieldProblem } from "@/components/ui/FieldProblem";
import { UnitQuestions } from "@/components/agent/UnitQuestions";
import { CONDITION_CHOICES, FURNISHING_CHOICES, type Furnishing } from "@/lib/agent/listings-model";
import { takesShape } from "@/lib/listings/unit-shape";
import type { Dictionary } from "@vallo/i18n/core";
import { Choice, CONDITION_OBJECT, Field } from "./parts";
import { digitsOnly } from "./model";
import type { StepCtx } from "./context";

/**
 * DETAILS: "What is the place like?" The unit's shape (V-66), its furnishing,
 * which floor, and its build condition, which is a fact about the BUILDING
 * and is asked of a let as well as a sale.
 */
export function PlaceStep({ ctx, unitCopy }: { ctx: StepCtx; unitCopy: Dictionary["shape"]["unit"] }) {
  const { values, set, copy, errors, asks, mark } = ctx;
  const rooms = copy.drawn.rooms;
  return (
    <>
      {takesShape(values.propertyType) ? (
        <UnitQuestions
          copy={unitCopy}
          value={values.unit}
          bedrooms={values.bedrooms}
          error={errors.unitShape}
          onChange={(next) => set("unit", next)}
        />
      ) : null}
      {asks("furnishing") ? (
        <Field label={rooms.furnishing} fromMessage={mark("furnished")} error={errors.furnished}>
          <select
            className="nf-field"
            value={values.furnished}
            onChange={(e) => set("furnished", e.target.value as Furnishing | "")}
          >
            <option value="">{rooms.notStated}</option>
            {FURNISHING_CHOICES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {asks("floor") ? (
        <div>
          <div className="grid grid-cols-2 items-end gap-row">
            <Field label={rooms.floor} hint={rooms.floorAsk}>
              <input
                className="nf-field"
                inputMode="numeric"
                value={values.floor}
                onChange={(e) => set("floor", digitsOnly(e.target.value, 3))}
                placeholder="2"
              />
            </Field>
            <Field label={rooms.floors} hint={rooms.floorsAsk}>
              <input
                className="nf-field"
                inputMode="numeric"
                value={values.totalFloors}
                onChange={(e) => set("totalFloors", digitsOnly(e.target.value, 3))}
                placeholder="5"
              />
            </Field>
          </div>
          <FieldProblem id="wizard-floor-problem" message={errors.floor ?? errors.totalFloors} />
        </div>
      ) : null}
      {asks("condition") ? (
        <fieldset>
          <legend className="nf-label mb-inline">{copy.drawn.checkOver.keys.condition}</legend>
          <div className="nf-lw-choices">
            {CONDITION_CHOICES.map((c) => (
              <Choice
                key={c.value}
                name={c.label}
                object={CONDITION_OBJECT[c.value]}
                chosen={values.condition === c.value}
                onClick={() => set("condition", values.condition === c.value ? "" : c.value)}
              />
            ))}
          </div>
        </fieldset>
      ) : null}
    </>
  );
}
