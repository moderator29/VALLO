/**
 * THE FIRST-RUN SHEETS AFTER SIGN-UP, the part with no I/O: who is shown
 * them, and how often.
 *
 * Anyone whose account has no profile photo is asked for one, skippable. The
 * ask must never become a nag:
 *
 *   - at most once per browser session (a session cookie the sheet sets as it
 *     opens), so moving between pages never re-opens it;
 *   - after a skip, not again for `SKIP_QUIET_DAYS` days (a cookie the skip
 *     sets), however many sessions begin in between.
 *
 * Both limits live in cookies the server writes and reads, so a refresh or a
 * second tab cannot get round them and nothing needs a database column.
 */
export const SETUP_SKIP_COOKIE = "vallo_setup_skip";
export const SETUP_SHOWN_COOKIE = "vallo_setup_shown";
/** Not asked again for this long after "Skip for now". */
export const SKIP_QUIET_DAYS = 3;
export const SKIP_COOKIE_SECONDS = 30 * 24 * 60 * 60;
/*
 * "CONFIRM YOUR INFORMATION" IS GONE (13 November 2026, the founder: every
 * member already gives their first name and surname at sign-up, on the email
 * form and on the Google or Apple finish-setup form, both required by the
 * server, so asking again was useless). The name step, its "name-confirmed"
 * first-run key and the full-name splitter went with it. Nothing else read
 * that key: no gate, no identity check.
 */

export type SetupStep = "photo";

export type SetupDecision = { show: false } | { show: true; steps: SetupStep[] };

const DAY_MS = 24 * 60 * 60 * 1000;

export function setupDecision(input: {
  needPhoto: boolean;
  /** When "Skip for now" was last pressed (epoch ms), or null. */
  skippedAt: number | null;
  /** The session cookie says the sheet already opened in this session. */
  shownThisSession: boolean;
  now: number;
}): SetupDecision {
  const steps: SetupStep[] = [];
  if (input.needPhoto) steps.push("photo");
  if (steps.length === 0) return { show: false };
  if (input.shownThisSession) return { show: false };
  if (input.skippedAt !== null && Number.isFinite(input.skippedAt)) {
    const since = input.now - input.skippedAt;
    /* A skip dated in the future (a clock that moved) counts as just now. */
    if (since < SKIP_QUIET_DAYS * DAY_MS) return { show: false };
  }
  return { show: true, steps };
}

/** The cookie's epoch milliseconds, or null when it is absent or not a number. */
export function readSkipCookie(value: string | undefined): number | null {
  if (!value || !/^\d{10,15}$/.test(value)) return null;
  return Number(value);
}
