import { countWord, notLive, oldestAge, sentences } from "./common";

export type AppealsContextInput = {
  /** The status tab in plain words: waiting, accepted or upheld. */
  statusLabel: string;
  /** Creation times of the appeals in this view. */
  createdAt: readonly string[];
};

export function appealsContext(input: AppealsContextInput | null, nowMs: number): string {
  if (!input) return notLive("Appeals");
  const n = input.createdAt.length;
  return sentences([
    `${countWord(n, "appeal")} in the ${input.statusLabel} view`,
    n > 0 && input.statusLabel === "waiting" ? `The oldest was lodged ${oldestAge(input.createdAt, nowMs)} ago` : null,
    "An appeal is decided by someone other than the person who made the original decision",
  ]);
}
