import { countWord, notLive, oldestAge, sentences } from "./common";

export type AgreementsContextInput = {
  /** Submission times of the agreements waiting for review. */
  waitingSubmittedAt: readonly (string | null)[];
  decidedRecently: number;
  /** Watch-list rows, or null when the watch list is not open yet. */
  watching: number | null;
};

export function agreementsContext(input: AgreementsContextInput | null, nowMs: number): string {
  if (!input) return notLive("Agreements");
  const waiting = input.waitingSubmittedAt.length;
  const oldest = oldestAge(input.waitingSubmittedAt, nowMs);
  return sentences([
    waiting > 0
      ? `${countWord(waiting, "agreement")} waiting for review${oldest ? `, the oldest submitted ${oldest} ago` : ""}`
      : "No agreement is waiting for review",
    `${input.decidedRecently} recently decided`,
    input.watching !== null ? `${countWord(input.watching, "payment")} on the watch list` : null,
  ]);
}
