"use client";

import type { MouseEvent } from "react";

/**
 * THE WAY OUT OF A FAILURE SCREEN IS NEVER A DEAD BUTTON (13 November 2026,
 * the founder's screenshot of the app's weak-connection moment on /home: both
 * "Try again" and "Vallo home" did nothing).
 *
 * A failure screen's home or back action was a client-side link. Two ways that
 * goes dead:
 *
 *   1. The failing page IS the target (the home screen failed and its way out
 *      is "home"): a soft navigation to the address already on screen changes
 *      nothing, so the tap looks ignored. Here the action tries the page again
 *      (`again`, the boundary's `retry ?? reset`), which is what the person
 *      asked for.
 *   2. The target is another page: a soft navigation goes through the same
 *      client router and the same server that just failed, and can fail the
 *      same way. Here the action is a FULL navigation (`location.assign`),
 *      which also clears whatever broke the router in this tab.
 *
 * The element stays a real link with its `href`, so a long press, a middle
 * click, "open in new tab" and a screen reader all still treat it as one; only
 * an ordinary click (left button, no modifier) is taken over.
 */
export function escapeTo(href: string, again: () => void) {
  return (event: MouseEvent<HTMLElement>): void => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const target = new URL(href, window.location.href);
    if (target.origin === window.location.origin && trim(target.pathname) === trim(window.location.pathname)) {
      again();
      return;
    }
    window.location.assign(target.href);
  };
}

function trim(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}
