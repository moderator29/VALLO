import { countWord, notLive, oldestAge, sentences } from "./common";

export type OperationsContextInput = {
  tab: string;
  /** Creation times of the open alerts the alerts read returned. */
  openAlertTimes: readonly string[] | null;
  /** The alerts read hit its page cap, so the count is a floor. */
  alertsCapped: boolean;
  /**
   * The job health panel this desk draws: how many scheduled jobs there are
   * and how many have gone quiet past their allowance. Absent until the page
   * passes them; the copilot reads them with get_job_health either way.
   */
  jobsTotal?: number | null;
  jobsStale?: number | null;
  /** Critical alerts among the open ones, when the page counted them. */
  criticalAlerts?: number | null;
};

export function operationsContext(input: OperationsContextInput | null, nowMs: number): string {
  if (!input) return notLive("Operations");
  const n = input.openAlertTimes?.length ?? null;
  const stale = input.jobsStale ?? null;
  const jobs = input.jobsTotal ?? null;
  return sentences([
    n !== null ? `${input.alertsCapped ? "At least " : ""}${countWord(n, "open alert")}${n > 0 ? `, the oldest raised ${oldestAge(input.openAlertTimes ?? [], nowMs)} ago` : ""}` : null,
    typeof input.criticalAlerts === "number" ? `${countWord(input.criticalAlerts, "of them is critical", "of them are critical")}` : null,
    jobs !== null && stale !== null
      ? `${countWord(jobs, "scheduled job")} on this screen, ${stale} of them quiet past their allowance`
      : null,
    `The viewer is on the ${input.tab} tab (scheduled jobs, alerts, audit log, notifications, in flight or store checks)`,
    stale === null ? "Job health and the audit log are on screen, not passed here: read them with get_job_health or get_open_alerts rather than quoting a number" : null,
  ]);
}
