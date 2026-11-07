"use client";

import { useId } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";

/**
 * OPTION CARDS (Platform Grade 1; docs/UX_SYSTEM.md section 9; references R18,
 * R29 to R31). One choice from a few, as full-width cards: a thin glyph, a
 * bold name, one grey line of what it means, and a radio circle that fills.
 * The selected card takes the accent border and a tinted ground. A real radio
 * group to assistive technology (arrow keys move the choice).
 *
 * Used by verification (which document) and the listing wizard (what you are
 * listing, your connection to it, residential or commercial).
 */
export type OptionCard = { value: string; label: string; detail?: string; icon?: UiIconName };

export function OptionCards({
  options,
  value,
  onChange,
  label,
  columns = 1,
  testId,
}: {
  options: readonly OptionCard[];
  value: string | null;
  onChange: (value: string) => void;
  /** The question, as the group's accessible name. */
  label: string;
  /** Two columns on a wide screen for four short options (R19). */
  columns?: 1 | 2;
  testId?: string;
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className="nf-g1-options" data-columns={columns} data-testid={testId}>
      {options.map((option) => {
        const on = value === option.value;
        return (
          <label key={option.value} className="nf-g1-option" data-on={on || undefined}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={on}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.icon ? (
              <span className="nf-g1-option__icon" aria-hidden="true">
                <UiIcon name={option.icon} size={24} weight="lean" />
              </span>
            ) : null}
            <span className="nf-g1-option__text">
              <span className="nf-g1-option__label">{option.label}</span>
              {option.detail ? <span className="nf-g1-option__detail">{option.detail}</span> : null}
            </span>
            <span className="nf-g1-option__radio" aria-hidden="true" />
          </label>
        );
      })}
    </div>
  );
}
