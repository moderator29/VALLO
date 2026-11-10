import { countWord, notLive, oldestAge, sentences } from "./common";

export type OperationsContextInput = {
  tab: string;
  /** Creation times of the open alerts the alerts read returned. */
  openAlertTimes: readonly string[] | null;
  /** The alerts read hit its page cap, so the count is a floor. */
  alertsCapped: boolean;
};

export function operationsContext(input: OperationsContextInput | null, nowMs: number): string {
  if (!input) return notLive("Operations");
  const n = input.openAlertTimes?.length ?? null;
  return sentences([
    n !== null ? `${input.alertsCapped ? "At least " : ""}${countWord(n, "open alert")}${n > 0 ? `, the oldest raised ${oldestAge(input.openAlertTimes ?? [], nowMs)} ago` : ""}` : null,
    `The viewer is on the ${input.tab} tab (scheduled jobs, alerts, audit log, notifications, in flight or store checks)`,
    "Job health and the audit log are on screen, not passed here, so do not quote their numbers",
  ]);
}
