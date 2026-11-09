"use client";

import { Chip, ChipRow } from "@/components/ui/Chip";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import { feedback } from "@/lib/ui/feedback";

/**
 * One answer from a few, as chips that wrap (the RoomOwl "Any 1 2 3 4"
 * picker). A real radio group: one tab stop, arrow keys move the choice. With
 * `anyLabel`, a first chip clears the answer (null).
 */
export function ChoiceChips<T extends string | number>({
  label,
  options,
  value,
  onChange,
  anyLabel,
  testId,
}: {
  label: string;
  options: readonly { value: T; label: string; icon?: UiIconName }[];
  value: T | null;
  onChange: (next: T | null) => void;
  anyLabel?: string;
  testId?: string;
}) {
  const pick = (next: T | null) => {
    if (next === value) return;
    feedback("select");
    onChange(next);
  };
  return (
    <div data-testid={testId}>
      <ChipRow radiogroup label={label} bleed={false} fadeEdges={false} snap={false} className="flex-wrap">
        {anyLabel ? (
          <Chip behaviour="choice" selected={value === null} onSelectedChange={() => pick(null)}>
            {anyLabel}
          </Chip>
        ) : null}
        {options.map((o) => (
          <Chip key={String(o.value)} behaviour="choice" selected={value === o.value} {...(o.icon ? { icon: o.icon } : {})} onSelectedChange={() => pick(o.value)}>
            {o.label}
          </Chip>
        ))}
      </ChipRow>
    </div>
  );
}

/** Several answers, each its own toggle (amenities, intents). */
export function ToggleChips<T extends string>({
  label,
  options,
  value,
  onChange,
  max,
  testId,
}: {
  label: string;
  options: readonly { value: T; label: string; icon?: UiIconName }[];
  value: readonly T[];
  onChange: (next: T[]) => void;
  max?: number;
  testId?: string;
}) {
  return (
    <div role="group" aria-label={label} className="nf-rm-togglechips" data-testid={testId}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <Chip
            key={o.value}
            behaviour="filter"
            selected={on}
            disabled={!on && typeof max === "number" && value.length >= max}
            {...(o.icon ? { icon: o.icon } : {})}
            onSelectedChange={(next) => {
              feedback("select");
              onChange(next ? [...value, o.value] : value.filter((v) => v !== o.value));
            }}
          >
            {o.label}
          </Chip>
        );
      })}
    </div>
  );
}
