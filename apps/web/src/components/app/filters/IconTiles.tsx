"use client";

import { useRef, type KeyboardEvent } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { BrandIcon, type BrandIconProp } from "@/design-system/icons/BrandIcon";
import { Icon3D } from "@/components/ui/Icon3D";
import type { Icon3DName } from "@/components/ui/icon-3d";

export type IconTileOption<T extends string> = {
  value: T;
  label: string;
  icon: UiIconName;
  /** The founder's 3D object (30 September) for a property type; drawn in
      the glyph's place, 40px, in a fixed box. */
  art?: Icon3DName | undefined;
  /** The realistic 3D object of a property type (the "Spaces for you" set),
      drawn in the same 40px box as `art`; it wins over `art` when both are set. */
  object?: BrandIconProp | undefined;
};

/**
 * A grid of icon tiles for a filter: property type (pick one) and space (pick
 * any). Cleaner than a dropdown because every answer is visible at once, and
 * each tile says itself twice, as a glyph and as a word, so it never rests on
 * the icon alone.
 *
 * THE SEMANTICS FOLLOW THE CHOICE, not the look:
 *   - `mode="single"` is a radio group. One tab stop (the chosen tile, or the
 *     first), arrow keys move AND choose, Home and End jump, and each tile is
 *     `role="radio"` with `aria-checked`.
 *   - `mode="multi"` is a group of checkboxes. Every tile is its own tab stop,
 *     Space and Enter toggle (a native button already does that), and each is
 *     `role="checkbox"` with `aria-checked`.
 * The selected state is drawn three ways, fill, ink and a tick in the corner,
 * so it reads in both themes and without colour.
 */
export function IconTiles<T extends string>({
  label,
  options,
  mode,
  selected,
  onToggle,
  testPrefix,
}: {
  /** The group's accessible name, normally the section heading. */
  label: string;
  options: readonly IconTileOption<T>[];
  mode: "single" | "multi";
  /** The chosen value(s). */
  selected: readonly T[];
  onToggle: (value: T) => void;
  testPrefix: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const single = mode === "single";
  const chosen = new Set(selected);
  const focusIndex = Math.max(
    0,
    options.findIndex((o) => chosen.has(o.value)),
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!single) return;
    const current = refs.current.findIndex((el) => el === document.activeElement);
    if (current < 0) return;
    const last = options.length - 1;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? (current + 1) % options.length
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? (current + last) % options.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    onToggle(options[next]!.value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role={single ? "radiogroup" : "group"}
      aria-label={label}
      onKeyDown={onKeyDown}
      className="nf-icon-tiles"
      data-testid={`${testPrefix}-tiles`}
    >
      {options.map((option, i) => {
        const on = chosen.has(option.value);
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role={single ? "radio" : "checkbox"}
            aria-checked={on}
            tabIndex={single ? (i === focusIndex ? 0 : -1) : 0}
            data-testid={`${testPrefix}-${option.value}`}
            onClick={() => onToggle(option.value)}
            className="nf-icon-tile-option"
          >
            {option.object ? (
              <span className="grid size-16 place-items-center" aria-hidden="true" data-object={option.object} data-host-plate>
                <BrandIcon name={option.object} size={64} preferRender />
              </span>
            ) : option.art ? (
              <span className="grid size-10 place-items-center" aria-hidden="true" data-art={option.art}>
                <Icon3D classic name={option.art} size={40} />
              </span>
            ) : (
              <span className="nf-icon-tile-option__glyph" aria-hidden="true">
                <UiIcon name={option.icon} size={24} />
              </span>
            )}
            <span className="nf-icon-tile-option__label">{option.label}</span>
            <span className="nf-icon-tile-option__tick" aria-hidden="true">
              <UiIcon name="check" size={16} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
