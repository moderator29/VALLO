import { countOf } from "@vallo/i18n/core";

import { notLive, sentences } from "./common";

export type TechnicalContextInput = {
  openIncidents: number;
  sev1or2Open: number;
  lateJobs: number | null;
  failingJobs: number | null;
  openErrorTypes: number | null;
  errorsLast24h: number | null;
  openAlerts: number | null;
  remindersDueSoon: number;
};

/** The Technical desk as counts. No incident title, no error message and no key, ever. */
export function technicalContext(input: TechnicalContextInput | null): string {
  if (!input) return notLive("Technical");
  const n = (value: number | null, say: (v: number) => string) => (value === null ? null : say(value));
  return sentences([
    `${countOf(input.openIncidents, "incidents")} open, ${input.sev1or2Open} of them severity 1 or 2`,
    n(input.lateJobs, (v) => `${countOf(v, "jobs")} late`),
    n(input.failingJobs, (v) => `${countOf(v, "jobs")} whose last run failed`),
    n(input.openErrorTypes, (v) => `${countOf(v, "errorTypes")} open in the crash log`),
    n(input.errorsLast24h, (v) => `${countOf(v, "errorTypes")} seen in the last 24 hours`),
    n(input.openAlerts, (v) => `${countOf(v, "alerts")} open`),
    input.remindersDueSoon > 0 ? `${countOf(input.remindersDueSoon, "reminders")} due within thirty days` : null,
  ]);
}
