import { countWord, sentences } from "./common";

export type AnalyticsContextInput = {
  range: string;
  /** Accounts the figures leave out (staff, QA), when read. */
  internalAccountsExcluded: number | null;
  /** Which of the page's reads came back live. */
  live: { bookings: boolean; supply: boolean; thinAreas: boolean; demand: boolean };
};

export function analyticsContext(input: AnalyticsContextInput): string {
  const missing = (Object.entries(input.live) as [string, boolean][]).filter(([, ok]) => !ok).map(([k]) => k);
  return sentences([
    `This is the Analytics desk, showing the last ${input.range}`,
    input.internalAccountsExcluded !== null
      ? `${countWord(input.internalAccountsExcluded, "internal account")} and all example listings are left out of the figures`
      : null,
    missing.length > 0 ? `These panels could not be read just now: ${missing.join(", ")}` : null,
    "The page's figures are on screen, not passed here, so do not quote any numbers",
  ]);
}
