"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The dock, out of the way while somebody is reading.
 *
 * Inbox item 212. The tab bar is a floating dock roughly 64px tall sitting
 * over the bottom of a 390px screen, which is a real fraction of a phone, and
 * it sits there permanently. Reading a list of places is exactly when
 * navigation is not the question, and exactly when the bottom eighth of the
 * screen is worth the most.
 *
 * Scrolling down hides it. Scrolling up brings it straight back, because
 * reaching for navigation IS an upward gesture: the thumb flicks up, the dock
 * arrives under it. No delay, no timer, nothing to wait for.
 *
 * Four rules stop it becoming a guessing game:
 *
 *   It never hides in the top 96px of a page. A dock that vanishes on the
 *   first flick of a screen the reader has barely entered reads as a glitch
 *   rather than as an affordance.
 *
 *   It never hides at the bottom of a page. Somebody who has scrolled to the
 *   end of a list should not have to scroll back up to leave.
 *
 *   It ignores movements under 8px, so a rubber-band bounce, a momentum
 *   settle or a thumb resting on the glass does not flicker it.
 *
 *   It comes back on focus, in CSS, so a keyboard reaching the dock while it
 *   is hidden reveals it rather than tabbing into something invisible.
 *
 * A NEW SCREEN ALWAYS STARTS WITH THE DOCK IN PLACE, and it used to be done by
 * remounting. The call site keyed this component on the active route, so a
 * navigation threw the node away and built a new one. That was the right answer
 * to a real problem, and two softer approaches had been tried and measured and
 * failed the same way: a dock hidden when the reader tapped Explore was still
 * hidden on the search screen, at scroll position zero, with nothing to scroll
 * up from. Resetting the state during render is not enough, because an app
 * navigation is a transition and the render that resets it is not the one that
 * commits. Waiting for the first scroll event is not enough, because a
 * navigation to the top of a page fires none.
 *
 * THE REMOUNT HAD A COST NOBODY HAD CHARGED IT FOR. The tab bar's highlight is
 * a single element that travels from the old tab to the new one, and an element
 * that is destroyed and rebuilt cannot travel: it can only appear, already
 * arrived. So the bar cut between destinations and no amount of CSS was going
 * to fix it, because the DOM node the CSS would have animated did not survive
 * the navigation.
 *
 * So the state REMEMBERS WHICH SCREEN IT WAS DECIDED ON, which is the third
 * approach and the one neither of the first two was. "Hidden" is not a fact
 * about the dock, it is a fact about a reader scrolling down a particular
 * screen, and the moment they are on a different screen it is not an answer to
 * anything. Comparing beats correcting: there is no second render, nothing to
 * schedule, and no frame in which the new screen shows the old screen's answer.
 * The node survives, the pill travels, and a new screen still starts with the
 * dock in place.
 *
 * The wrapper is a client component holding only this behaviour. The dock
 * itself stays a server component, which matters: it is handed the whole
 * dictionary, and turning it into a client component would serialise all of it
 * into the payload of every app page.
 */

/** Never hide within this distance of the top of the page. */
const SHOW_ABOVE = 96;
/** Never hide within this distance of the bottom of the page. */
const SHOW_NEAR_END = 48;
/** Movements smaller than this are noise, not a decision. */
const JITTER = 8;
/** How long a tapped tab may hold the pill before the bar reverts to the real route. */
export const PENDING_REVERT_MS = 7000;

export function AutoHideDock({
  label,
  route,
  className,
  children,
}: {
  label: string;
  /** The active route. Changing it puts the dock back on screen. */
  route: string;
  className?: string;
  children: ReactNode;
}) {
  /*
   * The state carries the route it was decided on, and the reset is a
   * COMPARISON rather than a second `setState`.
   *
   * A `useEffect` that calls `setHidden(false)` when the route changes also
   * works, and it is a cascading render the linter is right to refuse: the
   * component paints the old screen's answer once and then corrects itself.
   * Storing which screen the decision belongs to makes the correction free,
   * because a decision taken on a screen the reader has left is simply not the
   * current answer to anything.
   */
  const [decision, setDecision] = useState({ route, hidden: false });
  const hidden = decision.route === route ? decision.hidden : false;
  const lastY = useRef(0);

  /*
   * ONE RENDER PER DECISION, NOT PER FRAME (W2, round 5; "no scroll-linked
   * work"). The decision was set as a fresh object on every coalesced frame
   * of a scroll, and a fresh object is never equal to the last one, so the
   * dock re-rendered sixty times a second for as long as a finger moved a
   * list, to write the attribute it already had. The same answer now returns
   * the same state, which React skips: the dock renders when it hides and
   * when it comes back, and not in between.
   */
  const decide = (next: { route: string; hidden: boolean }) =>
    setDecision((prev) => (prev.route === next.route && prev.hidden === next.hidden ? prev : next));

  useEffect(() => {
    lastY.current = window.scrollY;
    let frame = 0;

    const read = () => {
      frame = 0;
      const y = window.scrollY;

      /*
       * WHERE the page is, before HOW it got there.
       *
       * These two guards used to sit behind the jitter check, and that was
       * wrong in a way only a browser found: `html` sets `scroll-behavior:
       * smooth`, so arriving at the foot of a page is an animation that ends
       * in a run of one and two pixel steps. Every one of those was under the
       * jitter threshold and returned early, so the last position the dock
       * ever acted on was somewhere mid-flight, scrolling down, hidden. The
       * page was at its very end with the dock off the screen and the rule
       * saying it must be there. Real momentum scrolling settles the same way.
       *
       * Jitter is a guard on the DIRECTION decision, which is the only thing a
       * two pixel wobble can get wrong. It has no business gating a fact.
       */
      const atEnd = y + window.innerHeight >= document.documentElement.scrollHeight - SHOW_NEAR_END;
      if (y <= SHOW_ABOVE || atEnd) {
        lastY.current = y;
        decide({ route, hidden: false });
        return;
      }

      const delta = y - lastY.current;
      if (Math.abs(delta) < JITTER) return;
      lastY.current = y;
      decide({ route, hidden: delta > 0 });
    };

    /* Coalesced into one frame: a scroll event fires far more often than the
       compositor paints, and setting state on each one is work nobody sees. */
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(read);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
    /* Re-anchored per route, so the scroll listener records its decisions
       against the screen the reader is actually on. */
  }, [route]);

  /*
   * B1, SECOND RULING: THE PILL MOVES ON THE TAP, NOT WHEN THE ROUTE LANDS.
   * The chosen tab opens into its pill with its word; waiting for the server
   * to answer before moving it made the dock lag the finger by a round trip.
   * The tapped tab is marked `data-on` at once and the row `data-dock-pending`
   * (shell-m.css draws the pill on it and steps the old one back); the marks
   * clear when the route arrives, where `aria-current` takes over.
   */
  const [pendingOn, setPendingOn] = useState<string | null>(null);
  const pending = pendingOn === route;
  useEffect(() => {
    return () => {
      for (const el of document.querySelectorAll(".nf-tab__link[data-on]")) el.removeAttribute("data-on");
    };
  }, [route]);
  /*
   * A TAP THAT NEVER LANDS GIVES THE BAR BACK ITS TRUTH. On a weak or dead
   * network the new route can take a long time, or never arrive. The tapped
   * tab keeps the pill for a moment (the finger was answered), then the bar
   * returns to the screen the reader is actually on, so it never says "Feed"
   * over a Home that is still showing. A route that lands first clears this
   * through the effect above.
   */
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => {
      for (const el of document.querySelectorAll(".nf-tab__link[data-on]")) el.removeAttribute("data-on");
      setPendingOn(null);
    }, PENDING_REVERT_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);
  const onClickCapture = (event: React.MouseEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const link = (event.target as Element).closest("a.nf-tab__link");
    if (!link || link.getAttribute("aria-current") === "page") return;
    for (const el of document.querySelectorAll(".nf-tab__link[data-on]")) el.removeAttribute("data-on");
    link.setAttribute("data-on", "");
    setPendingOn(route);
  };

  return (
    <nav
      aria-label={label}
      data-dock-hidden={hidden ? "true" : undefined}
      data-dock-pending={pending ? "" : undefined}
      onClickCapture={onClickCapture}
      className={className}
    >
      {children}
    </nav>
  );
}
