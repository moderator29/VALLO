import { countOf } from "@vallo/i18n/core";
import { countWord, notLive, sentences } from "./common";

export type CasesContextInput = {
  /** Cases matching the current filters. */
  total: number;
  /** Rows on the page being shown. */
  shown: number;
  overdueOnPage: number;
  /** The status filter in plain words, or null for all. */
  statusFilter: string | null;
  narrowed: boolean;
};

export function casesContext(input: CasesContextInput | null): string {
  if (!input) return notLive("Cases");
  return sentences([
    `${countWord(input.total, "case")} match the current view${input.statusFilter ? ` (status: ${input.statusFilter})` : ""}${input.narrowed ? ", which has extra filters on" : ""}`,
    countOf(input.overdueOnPage, "shownPastDeadline").replace("{shown}", String(input.shown)),
    "Counts are for the filtered view, not every case",
  ]);
}
