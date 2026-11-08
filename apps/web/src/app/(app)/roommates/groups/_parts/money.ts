import { readNairaTyping } from "@/lib/ui/naira-input";

/**
 * Naira as typed, for the roommate forms (FE-B): the box shows the grouped
 * figure ("1,500,000") and the write takes kobo. Whole naira only.
 */
export function nairaDisplay(raw: string): string {
  return readNairaTyping(raw).display;
}

/** Kobo from what the box shows, or null when it is empty or not a figure. */
export function koboOf(display: string): number | null {
  const { value } = readNairaTyping(display);
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** The box's text for an amount in kobo. */
export function displayOf(minor: number | null): string {
  return minor === null ? "" : readNairaTyping(String(Math.round(minor / 100))).display;
}
