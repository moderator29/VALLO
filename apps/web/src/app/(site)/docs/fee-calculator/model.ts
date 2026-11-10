import { listerFeeFigures, listerFeeShown, type ListerFeePolicy } from "@/lib/money/lister-fee";

/**
 * THE DOCS' FEE CALCULATOR, AS PURE ARITHMETIC (DOCS_AND_PRESENCE_UPGRADE.md
 * 4.6; R98). A reader puts in a nightly price and a number of nights, or a
 * number of tables seated, and sees what the guest pays and where it goes.
 *
 * NO FIGURE OF ITS OWN. A stay and a hotel room run through the lister fee
 * screen's own functions (`listerFeeFigures`, then `listerFeeShown` with the
 * protected rail's row never drawn), on the rates the server read
 * (`config.ts`), so the calculator and the fee screen a lister accepts cannot
 * disagree. The restaurant bill is the seated fee in force times the tables.
 * Rent and sales are not offered at all: payment for either is not open.
 *
 * Client-safe and pure, integer kobo throughout.
 */

/** The longest stay the calculator works out, in nights. */
export const MAX_NIGHTS = 90;
/** The most tables a month it works out. */
export const MAX_TABLES = 5_000;

export type StayRates = {
  /** The rates in force, as the fee screen reads them. */
  policy: ListerFeePolicy;
  /**
   * Whether the processor's most is known. It is read only for a signed-in
   * reader (`lister_fee_policy`); signed out it is not shown, and the host's
   * figure is labelled "before payment processing" instead of guessed.
   */
  processorKnown: boolean;
};

export type FeeCalcConfig = {
  stay: StayRates | null;
  hotel: StayRates | null;
  restaurant: { seatedFeeMinor: number } | null;
};

export type StayResult = {
  totalMinor: number;
  valloMinor: number;
  valloPercentText: string;
  valloCapped: boolean;
  /** The most the processor's fee can be, or null when it is not known. */
  processorUpToMinor: number | null;
  /** What the host receives at least: after payment processing when known, before it when not. */
  receiveMinor: number;
};

/**
 * What a stay of `nights` at `nightlyMinor` comes to, or null when there is
 * nothing honest to show (no price yet, a figure out of range, rates that do
 * not parse). Null is drawn as a sentence, never as a zero.
 */
export function stayResult(rates: StayRates, nightlyMinor: number | null, nights: number): StayResult | null {
  if (nightlyMinor === null || !Number.isSafeInteger(nightlyMinor) || nightlyMinor <= 0) return null;
  if (!Number.isInteger(nights) || nights < 1 || nights > MAX_NIGHTS) return null;
  const totalMinor = nightlyMinor * nights;
  if (!Number.isSafeInteger(totalMinor)) return null;
  /* The protected rail is off, so its row is never drawn; with the processor
     unknown its cap is left out of the arithmetic, and the figure is labelled
     as before processing rather than given a guessed deduction. */
  const policy: ListerFeePolicy = {
    ...rates.policy,
    escrowShown: false,
    directProcessorFeeCapMinor: rates.processorKnown ? rates.policy.directProcessorFeeCapMinor : 0,
  };
  const figures = listerFeeFigures(totalMinor, policy);
  if (!figures) return null;
  const shown = listerFeeShown(figures, policy);
  return {
    totalMinor,
    valloMinor: figures.valloMinor,
    valloPercentText: figures.valloPercentText,
    valloCapped: figures.valloCapped,
    processorUpToMinor: rates.processorKnown ? figures.processorUpToMinor : null,
    receiveMinor: shown.receiveLowMinor,
  };
}

/** What Vallo bills a restaurant for `tables` seated, or null when the count is not a count. */
export function restaurantBill(seatedFeeMinor: number, tables: number): number | null {
  if (!Number.isSafeInteger(seatedFeeMinor) || seatedFeeMinor < 0) return null;
  if (!Number.isInteger(tables) || tables < 1 || tables > MAX_TABLES) return null;
  const bill = seatedFeeMinor * tables;
  return Number.isSafeInteger(bill) ? bill : null;
}
