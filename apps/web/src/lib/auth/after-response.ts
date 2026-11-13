import "server-only";

import { after } from "next/server";

/**
 * WORK THAT DOES NOT DECIDE THE ANSWER RUNS AFTER IT (SPEED, 13 November 2026).
 *
 * A sign-up used to wait, in front of the person, for the "no news" setting,
 * the terms receipt and the welcome email's queue row: five database round
 * trips that decide nothing about what the screen says next. They still run,
 * every time, through Next's `after()` (node_modules/next/dist/docs/01-app/
 * 03-api-reference/04-functions/after.md): once the response has gone, for
 * the route's own maximum duration, and even when the action redirected.
 *
 * Never awaited by the caller. A failure is the work's own business: each
 * piece already catches and records its own trouble, and this adds a last
 * catch so nothing it does can surface as an unhandled rejection.
 *
 * Outside a request (a unit test or a script calling the action directly)
 * `after` throws; the work then starts at once, still unawaited.
 */
export function afterResponse(work: () => Promise<unknown>): void {
  const run = (): Promise<unknown> => {
    try {
      return Promise.resolve(work()).catch(() => undefined);
    } catch {
      return Promise.resolve();
    }
  };
  try {
    after(run);
  } catch {
    void run();
  }
}
