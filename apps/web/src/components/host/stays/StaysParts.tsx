"use client";

import type { ReactNode } from "react";
import { useHostCopy } from "@/components/host/host-copy";
import { Quantity } from "@/components/ui/Quantity";
import type { BrandIconName } from "@/design-system/icons/BrandIcon";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { BackControl } from "@/components/ui/BackControl";
import { IconPlate } from "@/components/ui/IconPlate";
import { Icon3D } from "@/components/ui/Icon3D";
import type { Icon3DName } from "@/components/ui/icon-3d";
import { lineGlyphFor } from "@/design-system/icons/glass-to-line";
import "@/app/css/catalogue.css";

/**
 * THE PARTS THE SIX DRAWN STAYS PANELS ARE ASSEMBLED FROM.
 *
 * `GOVERNING-10` and `GOVERNING-11` draw eight screens between them and they
 * are built from seven objects, not eighty: a head with its segments, a
 * labelled plate, a row, a tile, a stepper, a rule row and a calm note. Every
 * one of them is here once. The alternative, which is what the wizard did
 * before, is each step hand-rolling its own boxes, and the cost of that is
 * visible the moment two screens are put side by side: the property step's
 * group and the rooms step's group were the same object with two paddings.
 *
 * NOTHING HERE OWNS ANY BUSINESS RULE. What a place type means, what a house
 * rule writes into the column, what a band is: all of that is
 * `lib/host/stays-setup.ts`, pure and tested. These are shapes.
 */

/* -------------------------------------------------------------- the head */

/**
 * The way back, the progress segments beside it, the question, the sentence.
 *
 * THE SEGMENT COUNT IS THE FLOW'S AND NEVER THE RENDER'S FOUR. Every stays
 * screen in both images draws four segments because each image shows a
 * four-screen set-up. The real application has the steps it has, including the
 * identity document, the payout account and the three consents, and a bar that
 * drew four of them would be telling a host the flow is shorter than it is.
 * The anatomy is the render's; the arithmetic is the flow's.
 */
export function StaysHead({
  title,
  hint,
  steps,
  current,
  label,
  onBack,
}: {
  /**
   * The question. Omitted on `GOVERNING-11` screen three, the only drawn
   * screen whose heading sits BESIDE its glass object rather than above the
   * fields, and which therefore draws its own.
   */
  title?: string;
  hint?: string;
  /** How many steps this host will actually be asked for. */
  steps: number;
  /** Which one they are on, 1-based. */
  current: number;
  /** The already-composed "Step 4 of 9" a screen reader announces. */
  label: string;
  onBack?: () => void;
}) {
  return (
    <header>
      <div className="nf-stays-head">
        {onBack ? (
          <BackControl onBack={onBack} className="text-[var(--nf-brand-secondary)]" />
        ) : (
          <span className="h-11 w-11 shrink-0" aria-hidden="true" />
        )}
        <div
          className="nf-stays-head__track"
          role="progressbar"
          aria-label={label}
          aria-valuemin={1}
          aria-valuemax={steps}
          aria-valuenow={current}
          aria-valuetext={label}
        >
          {Array.from({ length: steps }, (_, i) => (
            <span
              key={i}
              className="nf-stays-head__seg"
              data-done={i < current}
              data-at={i === current - 1}
            />
          ))}
        </div>
      </div>
      {title ? <h1 className="nf-stays-title">{title}</h1> : null}
      {hint ? <p className="nf-stays-hint">{hint}</p> : null}
    </header>
  );
}

/* -------------------------------------------------------------- the hero */

/**
 * The lit glass object at the top of a set-up screen, floating on the canvas
 * with no container of its own. Two arrangements, both drawn: over the fields,
 * as `GOVERNING-10` screen one has the hotel, and beside the heading, as
 * `GOVERNING-11` screen three has the restaurant.
 */
/**
 * The founder's 3D objects (30 September) for the marks the sheets draw: the
 * hero of the hotel and restaurant steps, and the shortlet's place tiles.
 */
const STAYS_ART: Partial<Record<BrandIconName, Icon3DName>> = {
  "stays-hotel-palms": "hotel",
  "concierge-bell": "restaurant",
  "apartment-block": "apartment",
  "modern-house": "villa",
  "hotel-room": "stay-rated",
};

export function StaysHero({
  mark,
  inline = false,
  children,
}: {
  mark: BrandIconName;
  inline?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`nf-stays-hero${inline ? " nf-stays-hero--inline" : ""}`}>
      {/* The mark as a lean glyph on the brand plate (the icon upgrade): it
          centres above the words, or leads them in the inline hero. */}
      <span className={inline ? "shrink-0" : "flex justify-center"}>
        {STAYS_ART[mark] ? (
          <span className="grid size-[4.5rem] place-items-center" aria-hidden="true" data-art={STAYS_ART[mark]}>
            <Icon3D name={STAYS_ART[mark]!} size={72} priority />
          </span>
        ) : (
          <IconPlate size="lg" tone="brand">
            <UiIcon name={lineGlyphFor(mark)} size={24} />
          </IconPlate>
        )}
      </span>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------- the plate */

/** A lit well with the field's name small inside it, and the value under it. */
export function StaysPlate({
  label,
  note,
  htmlFor,
  children,
  className,
}: {
  label: string;
  /** One honest sentence about what this plate does, when it needs one. */
  note?: string;
  /** Set when the plate's label is the label for a single control inside it. */
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  const Label = htmlFor ? "label" : "span";
  return (
    <section className={["nf-stays-plate", className ?? ""].filter(Boolean).join(" ")}>
      <Label className="nf-stays-plate__label" {...(htmlFor ? { htmlFor } : {})}>
        {label}
      </Label>
      {children}
      {note ? <p className="nf-stays-plate__note">{note}</p> : null}
    </section>
  );
}

/* --------------------------------------------------------------- the row */

/** A name on the left, an answer on the right, a chevron when it opens. */
export function StaysRow({
  leading,
  children,
  trailing,
  className,
}: {
  leading?: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={["nf-stays-row", className ?? ""].filter(Boolean).join(" ")}>
      {leading}
      <span className="min-w-0 flex-1">{children}</span>
      {trailing}
    </div>
  );
}

/* ----------------------------------------------------------- the stepper */

/**
 * Minus and plus around a number, or joined beside one that is printed
 * elsewhere. Both are drawn and both are here, because the render uses each on
 * a different question rather than by accident.
 *
 * IT IS TWO BUTTONS AND A NUMBER, NOT A NUMBER INPUT. A stepper is how
 * somebody counts bedrooms on a phone without a keyboard covering the screen,
 * and the two controls are 44px each because that is the floor a thumb needs.
 */
export function StaysStepper({
  label,
  value,
  min = 0,
  max = 999,
  showValue = true,
  onChange,
  disabled = false,
}: {
  /** The accessible name, since the visible label is the row's. */
  label: string;
  value: number;
  min?: number;
  max?: number;
  /** False when the row already prints the number somewhere else. */
  showValue?: boolean;
  onChange(next: number): void;
  disabled?: boolean;
}) {
  const words = useHostCopy().stays.stepper;
  return (
    <Quantity
      value={value}
      min={min}
      max={max}
      label={label}
      decreaseLabel={words.fewer.replace("{what}", label)}
      increaseLabel={words.more.replace("{what}", label)}
      showValue={showValue}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

/** A labelled row whose answer is a stepper: the render's counted questions. */
export function StaysCountRow({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange(next: number): void;
  disabled?: boolean;
}) {
  return (
    <StaysRow
      trailing={
        <StaysStepper
          label={label}
          value={value}
          min={min}
          max={max}
          onChange={onChange}
          disabled={disabled}
        />
      }
    >
      <span className="nf-stays-row__value">{label}</span>
    </StaysRow>
  );
}

/* -------------------------------------------------------------- the tile */

/**
 * One of three or four answers, drawn as a plate with a mark, a word and a
 * tick when it is the chosen one.
 *
 * `role="radio"` and not a pressed button: these are mutually exclusive
 * answers to one question, and a group of toggle buttons announces itself as
 * four independent switches to anybody listening rather than looking.
 */
export function StaysTile({
  title,
  meaning,
  mark,
  selected,
  onSelect,
  variant = "mark",
}: {
  title: string;
  meaning?: string;
  mark?: BrandIconName;
  selected: boolean;
  onSelect(): void;
  /** "mark" draws the glass object, "band" is the centred price band tile. */
  variant?: "mark" | "band" | "text";
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`nf-stays-tile${variant === "band" ? " nf-stays-tile--band" : ""}`}
    >
      {variant === "mark" && mark && STAYS_ART[mark] ? (
        <span className="nf-stays-tile__mark grid size-12 place-items-center" aria-hidden="true" data-art={STAYS_ART[mark]}>
          <Icon3D name={STAYS_ART[mark]!} size={48} />
        </span>
      ) : (
        variant === "mark" &&
        mark && (
          <IconPlate size="md" className="nf-stays-tile__mark">
            <UiIcon name={lineGlyphFor(mark)} size={20} />
          </IconPlate>
        )
      )}
      <span className={variant === "band" ? undefined : "nf-stays-tile__title"}>{title}</span>
      {meaning && variant !== "band" && <span className="nf-stays-tile__meta">{meaning}</span>}
      {/*
        THE TICK IS NOT DRAWN ON A BAND TILE. `GOVERNING-11` screen three marks
        the chosen price band with its lit fill and nothing else, and a badge
        in the corner of a 56px tile whose whole content is four naira marks
        lands ON the marks. The lit fill is the state on that one variant.
      */}
      {selected && variant !== "band" && (
        <span className="nf-stays-tile__tick" aria-hidden="true">
          <UiIcon name="verified" size={12} />
        </span>
      )}
    </button>
  );
}

/** The grid the tiles sit in. Three across as drawn, or four for the bands. */
export function StaysTiles({
  label,
  columns = 3,
  children,
}: {
  label: string;
  columns?: number;
  children: ReactNode;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="nf-stays-tiles"
      style={{ "--nf-stays-tile-cols": columns } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/* --------------------------------------------------------- the round glyph */

/** A bare mark on a ring. The one object on these screens that stays round. */
export function StaysGlyph({ mark, icon }: { mark?: BrandIconName; icon?: UiIconName }) {
  return (
    <span className="nf-stays-glyph" aria-hidden="true">
      {mark ? <UiIcon name={lineGlyphFor(mark)} size={16} /> : icon ? <UiIcon name={icon} size={16} /> : null}
    </span>
  );
}

/* ---------------------------------------------------------- the calm note */

/**
 * The calm explanatory panel the whole reference set carries, and the only
 * place on these panels where a limit is allowed to be stated. It is used for
 * exactly that: what this screen saved, and what it did not.
 */
export function StaysNote({ children, icon = "info" }: { children: ReactNode; icon?: UiIconName }) {
  return (
    <aside className="nf-stays-note">
      <StaysGlyph icon={icon} />
      <p className="nf-stays-note__text">{children}</p>
    </aside>
  );
}
