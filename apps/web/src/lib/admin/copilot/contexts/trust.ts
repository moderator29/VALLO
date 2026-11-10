import { countWord, notLive, sentences } from "./common";

export type TrustContextInput = {
  days: number;
  open: number;
  overdue: number;
  escalated: number;
  unassigned: number;
  critical: number;
  openedInPeriod: number;
  resolvedInPeriod: number;
  medianHoursToResolve: number | null;
  restrictedNow: number;
  appealsOpen: number;
};

export function trustContext(input: TrustContextInput | null): string {
  if (!input) return notLive("Trust overview");
  return sentences([
    `${countWord(input.open, "case")} open: ${input.overdue} overdue, ${input.escalated} escalated, ${input.unassigned} not assigned and ${input.critical} critical`,
    `In the last ${input.days} days ${input.openedInPeriod} opened and ${input.resolvedInPeriod} resolved${input.medianHoursToResolve !== null ? `, median ${input.medianHoursToResolve} hours to resolve` : ""}`,
    `${countWord(input.restrictedNow, "member")} restricted now and ${countWord(input.appealsOpen, "appeal")} waiting`,
  ]);
}
