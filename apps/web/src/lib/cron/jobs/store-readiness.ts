import "server-only";

import { getDictionary, DEFAULT_LOCALE } from "@vallo/i18n";
import type { JobVerdict } from "../../bookings/lifecycle";
import { siteUrl } from "../../site";
import { summarise } from "../../store/readiness";
import { runStoreChecks } from "../../store/run";
import type { AdminClient } from "../rpc";

/**
 * V-52, THE NIGHTLY HALF: the same nine store checks the Store tab runs on
 * demand, run once a night against the production origin.
 *
 * The run itself is the audit row: `runCronJob` writes one `audit_log` entry
 * per run with these counts, which is what the operations desk reads. A red
 * check raises one risk alert naming which checks are red, so a store
 * readiness problem reaches the alert desk the morning it appears rather than
 * the afternoon the founder opens a submission. A check that could not run is
 * counted apart and never raises an alert on its own: an unreachable page is
 * the canary's business (V-01), not a store verdict.
 *
 * ---------------------------------------------------------------------------
 * WHY THE ALERT NOW CARRIES THE WORDS AND NOT JUST THE KEY.
 *
 * MEASURED 13 November 2026 on the live project. `public.job_runs` holds 17
 * runs of this job and the outcome of every single one is `repeat`, never
 * `ok`, from 2 October to 12 November: it has found something red on every
 * run for six weeks. 28 rows titled "Store: readiness, red" are open, and the
 * newest 19 of them say exactly this and nothing else:
 *
 *   {"pass":7,"fail":1,"not_run":1,"origin":"https://www.vallospaces.com",
 *    "red_1":"reviewer"}
 *
 * A key is not an action. `reviewer` fails for two completely different
 * reasons with two completely different answers: the credentials are not set
 * in the production environment (`configured: false`), or they are set and the
 * sign-in was refused, which means an App Store reviewer cannot get in and the
 * next submission is rejected. The desk could not tell which, so for six weeks
 * nobody did anything, which is the whole cost of a detail field that carries
 * an identifier instead of a sentence.
 *
 * So the alert now carries each red check's own words, and names the checks
 * that could not run rather than only counting them. The words come from the
 * copy dictionary and from the auth error, and an address is stripped out of
 * them before they go anywhere near a log line.
 */

/** Anything shaped like an address, out, before a detail reaches an alert. */
function withoutAddresses(text: string): string {
  return text.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "an address").slice(0, 300);
}
export async function storeReadiness(admin: AdminClient): Promise<JobVerdict> {
  const copy = getDictionary(DEFAULT_LOCALE).frontDoor.store;
  const run = await runStoreChecks(admin, siteUrl(), copy);
  const counts = summarise(run.checks);
  const red = run.checks.filter((check) => check.state === "fail").map((check) => check.key);
  const detail: Record<string, string | number | boolean | null> = {
    pass: counts.pass,
    fail: counts.fail,
    not_run: counts.unknown,
    origin: run.origin,
  };
  red.forEach((key, index) => {
    detail[`red_${index + 1}`] = key;
  });
  /* The sentence beside the key, so the desk knows WHICH failure it is. */
  for (const check of run.checks) {
    if (check.state === "fail" && check.detail) {
      detail[`why_${check.key}`] = withoutAddresses(check.detail);
    }
  }
  /* And the checks that could not run, named rather than only counted. They
     still raise no alert of their own; they are here so a red run says what
     else was not proved at the same time. */
  const notRun = run.checks.filter((check) => check.state === "unknown").map((check) => check.key);
  if (notRun.length > 0) detail["not_run_checks"] = notRun.join(", ");
  return {
    outcome: red.length > 0 ? "attention" : "ok",
    counts: { pass: counts.pass, fail: counts.fail, not_run: counts.unknown },
    detail,
    alert: red.length > 0 ? { kind: "store.readiness.red", severity: "warning", detail } : null,
  };
}
