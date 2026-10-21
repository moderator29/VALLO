"use client";

import { useState } from "react";
import { countOf, type Dictionary, type Locale } from "@vallo/i18n/core";
import { Amount } from "@/components/ui/Amount";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";
import type { RentPeriod } from "@/lib/listings/pricing";
import { TYPE } from "@/components/app/Screen";

/** The counted unit a rent period is quoted in. */
const PERIOD_UNIT = { month: "months", quarter: "quarters", year: "years" } as const satisfies Record<RentPeriod, string>;

/**
 * How long a tenancy, and what that comes to.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS, AND FIRMLY WHAT IT IS NOT.
 *
 * Nigerian rent is paid in whole terms up front, and one year is a floor rather
 * than a default: a landlord asking for two years at signing is ordinary. The
 * panel around this quoted one year and stopped, so somebody being asked for
 * two had to do the multiplication in their head on the way to the message.
 *
 * IT DOES NOT BOOK, HOLD, RESERVE OR CHARGE ANYTHING. `RentalPanel` carries no
 * Reserve control on purpose - the rental path is message the agent, inspect
 * the property, then pay - and this control does not open a second one. It
 * changes a number on a card. The only thing to press on this panel is still
 * "Message agent".
 *
 * ---------------------------------------------------------------------------
 * WHY THE CAPTION IS NOT DECORATION.
 *
 * Multiplying the rent by the term states a total, and a total on a screen
 * reads as a price somebody has agreed to. Nobody has. Rent is negotiated, a
 * second year is often not simply twice the first, and the fees around it -
 * caution, agency, legal - are a separate conversation this figure does not
 * include. So the caption says what the number is: the rent alone, for that
 * many terms, before anybody has agreed anything.
 *
 * That is the difference between a helpful sum and an invented quote.
 * ---------------------------------------------------------------------------
 */

/** Nobody signs a fifty year tenancy through a marketplace card. */
const MAX_TERMS = 5;

export function TenancyTerm({
  priceMinor,
  period,
  currency,
  locale,
  minimumTerms = 1,
  copy,
}: {
  /** The stepper's words (`t.memberFlows.rental`). */
  copy: Pick<Dictionary["memberFlows"]["rental"], "howLong" | "shorter" | "longer" | "rentFor" | "rentOnly">;
  /** The rent for ONE term, in kobo. */
  priceMinor: number;
  /** The term the rent is quoted in, so the noun follows the listing. */
  period: RentPeriod;
  currency: string;
  locale: Locale;
  /**
   * The shortest tenancy the agent stated, in terms.
   *
   * Rentals carry `minimum_tenancy_months`; the panel converts that into this
   * listing's own unit before handing it over, because a two-year minimum on a
   * yearly listing is 2 and on a monthly one is 24.
   */
  minimumTerms?: number;
}) {
  const floor = Math.max(1, Math.min(minimumTerms, MAX_TERMS));
  const [terms, setTerms] = useState(floor);

  const label = countOf(terms, PERIOD_UNIT[period], locale);

  return (
    <div className="mt-md border-t border-[var(--nf-panel-hair)] pt-md">
      <div className="flex items-center justify-between gap-sm">
        <span className={TYPE.rowTitle}>{copy.howLong}</span>
        {/*
          A stepper rather than a select, matching the guests control on the
          stay panel: the range is small, both ends are one tap, and the number
          stays visible instead of hiding inside a closed menu.
        */}
        <span className="flex items-center gap-2xs">
          <StepButton
            icon="minus"
            label={copy.shorter}
            disabled={terms <= floor}
            onClick={() => setTerms((n) => Math.max(floor, n - 1))}
          />
          <span
            className="nf-numeric min-w-[5.5rem] text-center text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]"
            aria-live="polite"
          >
            {label}
          </span>
          <StepButton
            icon="plus"
            label={copy.longer}
            disabled={terms >= MAX_TERMS}
            onClick={() => setTerms((n) => Math.min(MAX_TERMS, n + 1))}
          />
        </span>
      </div>

      {/* The sum only earns its place once it differs from the headline above,
          which already prints one term's rent. At the floor it would be the
          same figure twice, forty pixels apart. */}
      {terms > 1 && (
        <p className="mt-sm flex items-baseline justify-between gap-sm">
          <span className={TYPE.rowMeta}>{copy.rentFor.replace("{term}", label)}</span>
          <Amount
            minorUnits={priceMinor * terms}
            locale={locale}
            currency={currency}
            className="text-[length:var(--nf-text-body-lg)] font-bold leading-none tracking-tight text-[var(--nf-content-primary)]"
          />
        </p>
      )}

      <p className={`mt-xs ${TYPE.rowMeta}`}>
        {copy.rentOnly}
      </p>
    </div>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: "minus" | "plus";
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="glass"
      size="sm"
      iconOnly
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      /* Icon only, and still a rectangle. The shape law keeps a circle only for
         a control that is round in a governing reference: the avatar and the
         landing nav search glyph. No reference draws a stepper, and the one
         governing image that draws bare icon buttons at all
         (GOVERNING-chat-booking-card.png: back, call, overflow, send) draws every
         one of them as a rounded square. A surface with no reference inherits the
         register, and the register's control is the rectangle. */
      className="grid h-9 w-9 rounded-[var(--nf-radius-sm)] place-items-center text-[var(--nf-content-primary)] disabled:opacity-35"
    >
      <UiIcon name={icon} size={16} />
    </Button>
  );
}
