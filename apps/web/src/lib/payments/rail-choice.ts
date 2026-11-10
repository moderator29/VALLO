/**
 * THE PAYER'S CHOICE OF RAIL (founder ruling 2, 13 October 2026).
 *
 * Every payment for a deal happens inside Vallo, and Vallo never holds the
 * money: a licensed partner holds an escrow payment, a card payment is split
 * by the processor straight to the lister's account.
 *
 *   rent, shortlet   the payer picks: Escrow (preselected, recommended) or
 *                    Pay by card
 *   sale             escrow only
 *   hotel room       card only, at the price shown
 *   restaurant       card only (and bill payment stays off)
 *
 * The database decides what may be picked and applies the choice
 * (`public.payment_rail_options`, `public.payment_rail_choose`, pending
 * migration pov04); this module only reads its answer, fail closed, and says
 * what the payment step draws. Pure and client-safe.
 */

import { RENT_PAYMENT_OPEN } from "../rent/payment-open";

export type PayRail = "escrow" | "card";

export const PAY_RAILS: readonly PayRail[] = ["escrow", "card"];

/** What the database says about one agreement's rail, as read. */
export type PayChoice = {
  /** What may be picked, in the order the card draws them. */
  options: PayRail[];
  /** What the step preselects when nothing is chosen yet. */
  defaultRail: PayRail | null;
  /** What the payer stored, or null. */
  chosen: PayRail | null;
  /** The rail payment opens on now (the choice, or the default). */
  rail: PayRail | null;
  /** Whether the reader is the one who pays. */
  payer: boolean;
  /** Why the choice can no longer move, or null while it can. */
  locked: string | null;
  /**
   * Present (true) only when the server read escrow as not working right now
   * (`protectedRailLive()` false): escrow is then not offered, and a payer
   * who may pay by card is offered card instead.
   */
  escrowPaused?: true;
};

function isRail(v: unknown): v is PayRail {
  return v === "escrow" || v === "card";
}

/**
 * `payment_rail_options`' answer, or null when it is not one (a refusal, a
 * shape we do not know). Null draws no choice card: the page falls back to
 * the payment it already offered.
 */
export function readPayChoice(data: unknown, escrowOpen = true): PayChoice | null {
  const row = (data ?? null) as Record<string, unknown> | null;
  if (!row || row.status !== "ok" || !Array.isArray(row.options)) return null;
  /* Escrow first, always: it is the recommended option and the default. */
  const offered = PAY_RAILS.filter((rail) => (row.options as unknown[]).includes(rail));
  const choice: PayChoice = {
    options: offered,
    defaultRail: isRail(row.default) && offered.includes(row.default) ? row.default : (offered[0] ?? null),
    chosen: isRail(row.chosen) ? row.chosen : null,
    rail: isRail(row.rail) ? row.rail : null,
    payer: row.payer === true,
    locked: typeof row.locked === "string" && row.locked.length > 0 ? row.locked : null,
  };
  /* Escrow appears only when it can actually work. Where card is allowed it
     is offered instead; a purchase (escrow only) says escrow is paused. */
  if (!escrowOpen && offered.includes("escrow")) {
    const options = offered.filter((rail) => rail !== "escrow");
    return { ...choice, options, defaultRail: options[0] ?? null, escrowPaused: true };
  }
  return choice;
}

export type PayChoiceMode =
  /** Two options, Escrow preselected unless card was chosen. */
  | "choose"
  /** A sale (or an escrow row with no choice): escrow, said, not asked. */
  | "escrow_only"
  /** A hotel room or a restaurant: card, said, not asked. */
  | "card_only"
  /** Rent or shortlet while escrow is paused: card offered instead, and stored when the payer continues. */
  | "card_escrow_paused"
  /** A purchase while escrow is paused: nothing can be paid now, said plainly. */
  | "escrow_paused"
  /** A rental while payment for rentals is not open (`lib/rent/payment-open`): said, no rail offered. */
  | "rent_not_open"
  /** Nothing resolves: no card at all. */
  | "none";

export type PayChoiceView = {
  mode: PayChoiceMode;
  /** The option drawn as selected. */
  selected: PayRail | null;
  /** True when the payer can still change it here. */
  canChoose: boolean;
};

/**
 * What the step draws for a choice. `rentOpen` false (the launch position,
 * `RENT_PAYMENT_OPEN`) turns any rent agreement's choice into a plain fact:
 * no rail is offered, whatever the database would allow.
 */
export function payChoiceView(
  choice: PayChoice | null,
  agreementKind?: string,
  rentOpen: boolean = RENT_PAYMENT_OPEN,
): PayChoiceView {
  if (choice && agreementKind === "rent" && !rentOpen) {
    return { mode: "rent_not_open", selected: null, canChoose: false };
  }
  if (choice?.escrowPaused) {
    if (choice.options.includes("card")) {
      /* Card has to be STORED as the payer's choice before the card checkout
         opens (the database still reads escrow as the default), unless it
         already is. */
      return {
        mode: "card_escrow_paused",
        selected: "card",
        canChoose: choice.payer && choice.locked === null && choice.chosen !== "card",
      };
    }
    return { mode: "escrow_paused", selected: null, canChoose: false };
  }
  if (!choice || choice.options.length === 0) return { mode: "none", selected: null, canChoose: false };
  if (choice.options.length === 1) {
    const only = choice.options[0]!;
    return { mode: only === "escrow" ? "escrow_only" : "card_only", selected: only, canChoose: false };
  }
  const selected = choice.chosen ?? choice.rail ?? choice.defaultRail ?? "escrow";
  return { mode: "choose", selected, canChoose: choice.payer && choice.locked === null };
}

/** The refusals `payment_rail_choose` gives, each with its sentence in `payChoice.refused`. */
export const CHOICE_REFUSALS = [
  "not_found",
  "not_payer",
  "bad_choice",
  "closed",
  "already_paid",
  "payment_started",
  "sale_escrow_only",
  "card_only",
  "escrow_only",
  "no_rail",
  "card_needs_review",
  "unavailable",
] as const;

export type ChoiceRefusal = (typeof CHOICE_REFUSALS)[number];

export function readChoiceRefusal(status: unknown): ChoiceRefusal {
  return (CHOICE_REFUSALS as readonly string[]).includes(String(status)) ? (status as ChoiceRefusal) : "unavailable";
}

/**
 * Where the payer goes once a rail is chosen: the escrow step for escrow; the
 * card checkout for card (a stay's booking checkout, or the rent payment
 * screen when the rent charge is opened from the inspection).
 */
export function payNextHref(
  rail: PayRail,
  agreement: { id: string; kind: string; bookingId: string | null; inspectionId: string | null },
): string | null {
  if (rail === "escrow") return `/agreements/${agreement.id}/fund`;
  if (agreement.kind === "rent" && agreement.inspectionId) return `/rent/pay/${agreement.inspectionId}`;
  if (agreement.bookingId) return `/checkout/${agreement.bookingId}`;
  return null;
}
