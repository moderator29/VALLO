import { countWord, notLive, sentences } from "./common";

export type ListingsContextInput = {
  /** Real listings by status (examples are counted apart). */
  real: Partial<Record<"SUBMITTED" | "UNDER_REVIEW" | "MORE_INFO_REQUIRED" | "PUBLISHED" | "REJECTED" | "SUSPENDED", number>>;
  /** Example listings left out of the real figures. */
  examples: number | null;
  /** Median minutes from submitted to decided this week, and decisions that made it. */
  medianMinutesThisWeek: number | null;
  decisionsThisWeek: number;
};

export function listingsContext(input: ListingsContextInput | null): string {
  if (!input) return notLive("Listings");
  const waiting = (input.real.SUBMITTED ?? 0) + (input.real.UNDER_REVIEW ?? 0) + (input.real.MORE_INFO_REQUIRED ?? 0);
  return sentences([
    `${countWord(waiting, "real listing")} waiting for review (${input.real.SUBMITTED ?? 0} submitted, ${input.real.UNDER_REVIEW ?? 0} under review, ${input.real.MORE_INFO_REQUIRED ?? 0} waiting on the lister for more information)`,
    `${input.real.PUBLISHED ?? 0} live, ${input.real.REJECTED ?? 0} rejected and ${input.real.SUSPENDED ?? 0} suspended`,
    input.decisionsThisWeek > 0 && input.medianMinutesThisWeek !== null
      ? `${countWord(input.decisionsThisWeek, "decision")} this week, with a median of ${input.medianMinutesThisWeek} minutes from submission to decision`
      : "No review decision has been recorded this week",
    input.examples !== null && input.examples > 0 ? `${countWord(input.examples, "example listing")} left out of these figures` : null,
  ]);
}
