"use client";

import { toast } from "@/lib/ui/toast";
import { isNetworkError } from "./use-offline";

/**
 * A TAP THAT FAILED ON A WEAK SIGNAL STAYS ON ITS SCREEN (3 November 2026).
 *
 * The way a phone app behaves: when a like, a send, a save or a decision
 * cannot reach the server, the screen stays exactly as it was (what was typed,
 * what was chosen) and a short line slides up at the bottom saying so. It
 * used to throw out of the button into the route's error boundary, which
 * swapped the whole screen for an error page: a website's answer.
 *
 * Every button that runs a server action inside a transition calls this from
 * its catch (added to them all on 3 November 2026). A signal problem is
 * answered here and swallowed; anything else is a real fault and is thrown
 * on to the error boundary, exactly as before, so no bug is hidden.
 */

/** English, like the other words added before a native speaker has read them. */
const WORDS = "Couldn't connect. Check your signal and try again.";

let lastShownAt = 0;

export function tapFailedOffline(error: unknown): boolean {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (!offline && !isNetworkError(error)) return false;
  /* One line for a burst of failures, not a stack of them. */
  const now = Date.now();
  if (now - lastShownAt > 1_500) {
    lastShownAt = now;
    toast.error(WORDS, { "data-testid": "tap-failed-offline" });
  }
  return true;
}
