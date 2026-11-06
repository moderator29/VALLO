/**
 * WHEN A RUNNING PAGE SHOULD REPLACE ITSELF WITH THE DEPLOYED ONE.
 *
 * On 6 November 2026 the app kept running the notification bell's old script
 * for hours after the fix was live, and only deleting and reinstalling the app
 * cured it. The phone keeps a copy of every page it has seen (so screens open
 * at once, even offline) and a copy may answer for up to a week, with the
 * script file names it was kept with. A deploy therefore reached a phone one
 * visit late at best, and sometimes not at all.
 *
 * The page now asks the server which deploy is live (`/api/build`) when it
 * opens and each time the app comes back to the front, and reloads itself
 * once when that is not the deploy it is running. This file is the decision,
 * kept free of the browser so every branch is a test.
 */

/** A reload for the same deploy is not tried again for this long. */
export const RETRY_AFTER_MS = 30 * 60 * 1000;

export type ReloadDecision = {
  /** The deploy this page is running (empty when the build did not record one, as in development). */
  mine: string;
  /** The deploy the server says is live (empty when it could not say). */
  live: string;
  /** Somebody is typing or holds an unsent change: never reload under them. */
  editing: boolean;
  /** The last reload this page tried: which deploy, and when. */
  tried: { id: string; at: number } | null;
  now: number;
};

export function shouldReload(input: ReloadDecision): boolean {
  const { mine, live, editing, tried, now } = input;
  if (!mine || !live) return false;
  if (mine === live) return false;
  if (editing) return false;
  if (tried && tried.id === live && now - tried.at < RETRY_AFTER_MS) return false;
  return true;
}
