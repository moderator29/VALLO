"use client";

import { useId, type ReactNode } from "react";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { BrandIcon, type BrandIconName, type BrandIconProp } from "@/design-system/icons/BrandIcon";
import { lineGlyphFor } from "@/design-system/icons/glass-to-line";
import { SPACE_OBJECT } from "@/components/app/home/space-types";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { FieldProblem } from "@/components/ui/FieldProblem";
import { IconPlate } from "@/components/ui/IconPlate";
import { Icon3D } from "@/components/ui/Icon3D";
import type { Icon3DName } from "@/components/ui/icon-3d";
import { Quantity } from "@/components/ui/Quantity";
import { DetailGlyph } from "@/components/app/listing/DetailGlyph";
import { moveInLines } from "@/components/app/listing/move-in-lines";
import { feedback } from "@/lib/ui/feedback";
import type {
  BuildCondition,
  PowerBackup,
  PowerGrid,
  PropertyType,
  WaterSupply,
} from "@/lib/agent/listings-model";

/**
 * The wizard's drawn furniture, one component each so a step cannot draw its
 * own version: a labelled field, the calm explanatory panel, an option card,
 * the counter, a fact row, the "From your message" mark, the tenant's
 * breakdown, and (new with the one-question flow) the number chips.
 * Moved here unchanged from `ListingWizard.tsx` when the steps were split out;
 * the history of each is in the git log of that file.
 */

type WizardCopy = Dictionary["agentListings"];

/** A label, the control, an optional hint, and the field's problem for a screen reader. */
export function Field({
  label,
  hint,
  error,
  fromMessage,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  /** V-09: the "From your message" mark and its "Looks right" control, when this value came from a pasted broadcast. */
  fromMessage?: ReactNode;
  children: ReactNode;
}) {
  const problemId = useId();
  return (
    <label className="block">
      <span className="nf-label">
        {label}
        {fromMessage}
      </span>
      {children}
      {hint ? <span className="nf-body-sm mt-inline-tight block text-[var(--nf-content-muted)]">{hint}</span> : null}
      {/* A field's problem is said by the one banner; the note stays for a
          screen reader (founder, 7 November 2026, "THE BANNER EVERYWHERE"). */}
      <FieldProblem id={problemId} message={error} />
    </label>
  );
}

/** The calm explanatory panel with a small round glyph. */
export function Note({ children, glyph = "info", role }: { children: ReactNode; glyph?: UiIconName; role?: "status" }) {
  return (
    <div className="nf-lw-note" role={role}>
      <span className="nf-lw-note__glyph" aria-hidden="true">
        <UiIcon name={glyph} size={16} />
      </span>
      <p className="nf-lw-note__body">{children}</p>
    </div>
  );
}

/** One option card: an object, a word, a line under it, and the tick. */
export function Choice({
  name,
  sub,
  object,
  art,
  realistic,
  glyph,
  chosen,
  centred,
  onClick,
}: {
  name: string;
  sub?: string;
  object?: BrandIconName;
  /** The founder's 3D object, in place of the plate. */
  art?: Icon3DName | undefined;
  /** The realistic object the home's "Spaces for you" draws, in place of the 3D one. */
  realistic?: BrandIconProp | undefined;
  glyph?: UiIconName;
  chosen: boolean;
  centred?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        feedback("select");
        onClick();
      }}
      aria-pressed={chosen}
      className={`nf-lw-choice${centred ? " nf-lw-choice--centred" : ""}`}
    >
      {realistic ? (
        <span className="nf-lw-choice__object grid size-12 place-items-center" aria-hidden="true" data-art={realistic}>
          <BrandIcon name={realistic} size={48} preferRender />
        </span>
      ) : art ? (
        <span className="nf-lw-choice__object grid size-12 place-items-center" aria-hidden="true" data-art={art}>
          <Icon3D classic name={art} size={48} />
        </span>
      ) : object ? (
        <IconPlate size="sm" tone={chosen ? "brand" : "neutral"} className="nf-lw-choice__object">
          <UiIcon name={lineGlyphFor(object)} size={20} />
        </IconPlate>
      ) : glyph ? (
        <span className="nf-lw-choice__glyph" aria-hidden="true">
          <UiIcon name={glyph} size={24} />
        </span>
      ) : null}
      <span className="nf-lw-choice__name">{name}</span>
      {sub && <span className="nf-lw-choice__sub">{sub}</span>}
      {chosen && (
        <span className="nf-lw-choice__tick" aria-hidden="true">
          <UiIcon name="verified-badge" size={20} />
        </span>
      )}
    </button>
  );
}

/** The system's quantity stepper (section 19, kind 9), inline or full width. */
export function Stepper({
  value,
  min,
  max,
  label,
  fewerLabel,
  moreLabel,
  inline,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  fewerLabel: string;
  moreLabel: string;
  inline?: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <Quantity
      value={value}
      min={min}
      max={max}
      label={label}
      decreaseLabel={fewerLabel}
      increaseLabel={moreLabel}
      onChange={onChange}
      className={inline ? "justify-self-end" : "w-full justify-between"}
    />
  );
}

/** A fact row: the object on its plate, the fact, the question, the control. */
export function FactRow({
  glyph,
  name,
  ask,
  optional,
  children,
  stacked,
}: {
  glyph: UiIconName;
  name: string;
  ask: string;
  optional?: string;
  children: ReactNode;
  stacked?: boolean;
}) {
  return (
    <div className={`nf-lw-fact${stacked ? " nf-lw-fact--stacked" : ""}`}>
      <span className="nf-lw-fact__plate" aria-hidden="true">
        <UiIcon name={glyph} size={24} />
      </span>
      <span className="nf-lw-fact__head">
        <span className="min-w-0">
          <span className="nf-lw-fact__name">{name}</span>
          <span className="nf-lw-fact__ask">{ask}</span>
        </span>
        {optional && <span className="nf-lw-fact__optional">{optional}</span>}
      </span>
      <div className="nf-lw-fact__control">{children}</div>
    </div>
  );
}

/**
 * NUMBER CHIPS (R18.7, R32): a count answered with one tap. `0..top` as chips
 * and a last "top+1 or more" chip that opens the stepper for an exact figure,
 * so the common answers are one tap and the rare ones are still exact. A real
 * radio group to assistive technology.
 */
export function NumberChips({
  label,
  value,
  onChange,
  min = 0,
  top = 9,
  max = 20,
  moreLabel,
  fewerLabel,
  moreAria,
  optional,
  hint,
  fromMessage,
  testId,
}: {
  label: string;
  /** null when the count was never given (an optional count left blank). */
  value: number | null;
  onChange: (next: number | null) => void;
  min?: number;
  top?: number;
  max?: number;
  /** "More than 9". */
  moreLabel: string;
  fewerLabel: string;
  moreAria: string;
  optional?: string;
  hint?: string;
  fromMessage?: ReactNode;
  testId?: string;
}) {
  const headId = useId();
  const chips = Array.from({ length: top - min + 1 }, (_, i) => min + i);
  const over = value !== null && value > top;
  return (
    <div className="nf-lw2-count" data-testid={testId}>
      <p className="nf-lw2-count__head" id={headId}>
        <span className="nf-label">
          {label}
          {fromMessage}
        </span>
        {optional ? <span className="nf-lw2-count__optional">{optional}</span> : null}
      </p>
      <div role="radiogroup" aria-labelledby={headId} className="nf-lw2-chips">
        {chips.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            className="nf-lw2-chip"
            onClick={() => {
              feedback("select");
              /* An optional count can be taken back by tapping it again. */
              onChange(optional && value === n ? null : n);
            }}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={over}
          aria-label={moreLabel}
          className="nf-lw2-chip"
          onClick={() => {
            feedback("select");
            onChange(over ? value : top + 1);
          }}
        >
          {top + 1}+
        </button>
      </div>
      {over ? (
        <div className="nf-lw2-count__exact">
          <Quantity
            value={value}
            min={top + 1}
            max={max}
            label={label}
            decreaseLabel={fewerLabel}
            increaseLabel={moreAria}
            onChange={(next) => onChange(next)}
            className="w-full justify-between"
          />
        </div>
      ) : null}
      {hint ? <p className="nf-body-sm mt-inline-tight text-[var(--nf-content-muted)]">{hint}</p> : null}
    </div>
  );
}

/**
 * V-09: THE "FROM YOUR MESSAGE" MARK, AND THE ONE-TAP WAY TO CONFIRM IT.
 * "Looks right" confirms the value without retyping it, which is what clears
 * it from the set the submit gate reads; editing the field clears it too.
 */
export function FromMessageMark({ tag, confirm, onConfirm }: { tag: string; confirm: string; onConfirm: () => void }) {
  return (
    <span className="ml-inline-tight inline-flex flex-wrap items-center gap-2xs align-middle" data-testid="from-message">
      <span className="nf-badge nf-badge--info">{tag}</span>
      <Button
        variant="quiet"
        size="sm"
        className="min-h-11"
        onClick={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        {confirm}
      </Button>
    </span>
  );
}

/**
 * WHAT A TENANT WILL ACTUALLY PAY, on the agent's own screen. It shares the
 * model (`moveInLines`) rather than mirroring it: an undeclared cost is still
 * listed as "Not declared" with no figure and adds nothing to the total; a
 * declared zero agency fee reads "No agency fee". There is no Vallo row
 * because there is no Vallo fee here.
 */
export function TenantPays({
  facts,
  currency,
  locale,
  copy,
  moveInCopy,
  moneyMap,
}: {
  facts: Parameters<typeof moveInLines>[0];
  currency: string;
  locale: Locale;
  copy: WizardCopy;
  moveInCopy: Dictionary["moveIn"];
  moneyMap?: Dictionary["afterTheGate"]["moneyMap"];
}) {
  /* V-46: before a mandate is dated by staff no caption names a landlord. */
  const lines = moveInLines(
    facts,
    moveInCopy,
    moneyMap ? { ctx: { mandateVerified: false, ownershipVerified: false }, copy: moneyMap } : undefined,
  );
  const declared = lines.filter((line) => line.minor !== undefined && line.minor !== null);
  const total = declared.reduce((sum, line) => sum + (line.minor ?? 0), 0);
  if (declared.length === 0) return <Note>{copy.drawn.tenantPays.empty}</Note>;
  return (
    <div className="nf-movein" data-testid="wizard-tenant-pays">
      <ul className="nf-movein__list">
        {lines.map((line) => {
          const isDeclared = line.minor !== undefined && line.minor !== null;
          return (
            <li key={line.key} className="nf-movein__row" data-declared={isDeclared || undefined} data-testid={`wizard-pays-${line.key}`}>
              <DetailGlyph name={line.glyph} className="nf-movein__plate" />
              <span className="nf-movein__name">
                <span className="nf-movein__label">
                  {line.label}
                  {line.basis && <span className="nf-movein__basis"> ({line.basis})</span>}
                </span>
                {isDeclared && line.minor !== 0 && line.keeper && <span className="nf-movein__keeper">{line.keeper}</span>}
              </span>
              <span className="nf-movein__figure">
                {isDeclared ? (
                  line.key === "agency" && line.minor === 0 ? (
                    <span className="nf-movein__free">{moveInCopy.noAgencyFee}</span>
                  ) : (
                    <Amount minorUnits={line.minor as number} locale={locale} currency={currency} />
                  )
                ) : (
                  <span className="nf-movein__undeclared">{moveInCopy.notDeclared}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="nf-movein__total" data-testid="wizard-pays-total">
        <DetailGlyph name="coins" size="lg" className="nf-movein__plate nf-movein__plate--total" />
        <span className="min-w-0">
          <span className="nf-movein__total-label">{moveInCopy.totalFrom}</span>
          <span className="nf-movein__total-figure">
            <Amount minorUnits={total} locale={locale} currency={currency} />
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * The one refusal shake (lister-publish.css, `[data-refused]`), replayed on
 * every refusal. The attribute is the DOM's, not React's, so taking it off and
 * putting it back across a reflow restarts the animation without remounting
 * the field the lister is typing in.
 */
export function refuse(el: HTMLElement | null) {
  if (!el) return;
  el.removeAttribute("data-refused");
  void el.offsetWidth;
  el.setAttribute("data-refused", "");
}

/* ------------------------------------------------------------ the objects */

/** The realistic objects "Spaces for you" draws on the home, so a type looks the same wherever it appears. */
export const TYPE_REALISTIC: Partial<Record<PropertyType, BrandIconProp>> = {
  ...SPACE_OBJECT,
  shortlet: "serviced-block",
  hotel: "hotel",
};

/** The 3D object on each property type's card, where the sheets draw one. */
export const TYPE_ART: Partial<Record<PropertyType, Icon3DName>> = {
  apartment: "apartment",
  shortlet: "shortlet",
  home: "home-verified",
  villa: "villa",
  hotel: "hotel",
  rental: "keys",
  office: "city",
  land: "land",
  restaurant: "restaurant",
};

/** The object on each property type's card. */
export const TYPE_OBJECT: Record<PropertyType, BrandIconName> = {
  apartment: "apartment-block",
  shortlet: "shortlet",
  home: "modern-house",
  villa: "villa",
  hotel: "hotel",
  rental: "keys-home",
  shop: "shop-retail",
  office: "office-space",
  land: "land-plot",
  restaurant: "concierge-bell",
};

/** The four build conditions. */
export const CONDITION_OBJECT: Record<BuildCondition, BrandIconName> = {
  newly_built: "home-check",
  renovated: "home-ring",
  old: "townhouse",
  off_plan: "doc-home",
};

export const GRID_GLYPH: Record<PowerGrid, UiIconName> = {
  BAND_A: "bolt",
  MOSTLY_ON: "bolt",
  PATCHY: "bolt",
  RARELY: "bolt",
  NONE: "block",
};
export const BACKUP_GLYPH: Record<PowerBackup, UiIconName> = {
  NONE: "block",
  GENERATOR: "bolt",
  INVERTER: "bolt",
  SOLAR: "sun",
  GENERATOR_INVERTER: "bolt",
};
export const WATER_GLYPH: Record<WaterSupply, UiIconName> = {
  TREATED_MAINS: "bath",
  BOREHOLE: "bath",
  PUMPED_STORAGE: "bath",
  TANKER: "bath",
  NONE: "block",
};

/** The amenity tiles. Same mapping the listing page tiles use. */
export const AMENITY_GLYPH: Record<string, UiIconName> = {
  wifi: "wifi",
  ac: "snowflake",
  tv: "picture",
  kitchen: "kitchen",
  parking: "parking",
  pool: "pool",
  gym: "bolt",
  security: "verified",
  elevator: "arrow-up",
  furnished: "home",
  balcony: "building-apartment",
  garden: "map",
  laundry: "washing-machine",
  generator: "bolt",
  water: "bath",
  shower: "bath",
  breakfast: "utensils",
  workspace: "document",
};
