/**
 * THE INCOME LINE (backlog row 26, 29 October 2026): what a rent and a
 * move-in total are as a share of the reader's own monthly income, as
 * arithmetic and nothing else.
 *
 * It states two numbers (the rent as a share of one month's income, and the
 * move-in total as months of income) and never a verdict: nothing here says
 * a place is or is not within reach, because that is a decision about a
 * person's life and not a fact about a listing. The income is typed by the
 * reader, kept on their device and never sent anywhere.
 *
 * Money is integer kobo throughout; the only division is the final ratio.
 * Pure, so every rule is proved in `affordability.test.ts`.
 */

export type RentPeriodLike = "month" | "quarter" | "year";

/** How many months one rent payment covers. */
export const MONTHS_IN: Record<RentPeriodLike, number> = { month: 1, quarter: 3, year: 12 };

export type Affordability = {
  /** The rent per month, in kobo, rounded to a whole kobo. */
  monthlyRentMinor: number;
  /** Rent per month as a share of monthly income, 0.38 = 38%. */
  rentShare: number;
  /** The move-in total as months of income, or null when no total is stated. */
  moveInMonths: number | null;
};

/** A figure that is a positive whole number of kobo, or null. */
function positive(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

export function affordability(input: {
  rentMinor: number | null | undefined;
  period: RentPeriodLike;
  moveInMinor: number | null | undefined;
  incomeMinor: number | null | undefined;
}): Affordability | null {
  const rent = positive(input.rentMinor);
  const income = positive(input.incomeMinor);
  if (rent === null || income === null) return null;
  const monthlyRentMinor = Math.round(rent / MONTHS_IN[input.period]);
  const total = positive(input.moveInMinor);
  return {
    monthlyRentMinor,
    rentShare: monthlyRentMinor / income,
    moveInMonths: total === null ? null : total / income,
  };
}

/** The reader's typed naira, as kobo: "450000" to 45_000_000; null for anything that is not a positive whole naira figure. */
export function incomeMinorFromNaira(typed: string): number | null {
  const digits = typed.replace(/[^\d]/g, "");
  if (digits === "" || digits.length > 12) return null;
  const naira = Number(digits);
  return naira > 0 ? naira * 100 : null;
}
