"use client";

import { UiIcon } from "@/design-system/icons/UiIcon";
import { FieldProblem } from "@/components/ui/FieldProblem";
import { feedback } from "@/lib/ui/feedback";
import { AMENITY_GLYPH, Note } from "./parts";
import type { StepCtx } from "./context";

/** AMENITIES: three across, a glyph over one word, a round tick on the ones that are on. */
export function AmenitiesStep({
  ctx,
  amenities,
  chosen,
  onToggle,
}: {
  ctx: StepCtx;
  amenities: { code: string; label: string }[];
  chosen: readonly string[];
  onToggle: (code: string) => void;
}) {
  const names = ctx.copy.amenities.names as Record<string, string | undefined>;
  return (
    <>
      <Note>{ctx.copy.amenities.intro}</Note>
      <FieldProblem id="wizard-amenities-problem" message={ctx.errors.amenities} />
      <div className="nf-lw-tiles">
        {amenities.map((amenity) => {
          const active = chosen.includes(amenity.code);
          return (
            <button
              key={amenity.code}
              type="button"
              className="nf-lw-tile"
              aria-pressed={active}
              onClick={() => {
                feedback("select");
                onToggle(amenity.code);
              }}
            >
              <UiIcon name={AMENITY_GLYPH[amenity.code] ?? "circle-check"} size={24} />
              <span>{names[amenity.code] ?? amenity.label}</span>
              {active && (
                <span className="nf-lw-choice__tick" aria-hidden="true">
                  <UiIcon name="verified-badge" size={20} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
