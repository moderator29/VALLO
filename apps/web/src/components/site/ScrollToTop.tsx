"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { entryStamped, noteEntry } from "@/lib/ui/history";

/**
 * Scroll position, the big-app way: forward lands at the top, back lands where
 * you left off.
 *
 * THIS COMPONENT USED TO BE THE BUG. It was four lines that scrolled to
 * `(0, 0)` on every `pathname` change with no idea whether the change was a
 * push or a back, so a person who scrolled a long way down `/search`, opened a
 * place and came back was thrown to the top of the results every single time.
 * The browser had restored the position perfectly well; this component then
 * undid it. Measured on the real page at 390px: leave `/search` at scrollY
 * 502, come back at scrollY 153.
 *
 * The rule now:
 *
 *   push (a link, a form, a filter chip)   land at the top, instantly
 *   pop  (back or forward)                 land where that screen was left
 *
 * KEYED BY THE FULL URL, QUERY INCLUDED. `/search?q=Lagos&beds=2` and
 * `/search?q=Abuja` are two different screens to the person looking at them
 * and they scroll independently. Keying on `pathname` alone would hand one
 * search the other's position, which is worse than not restoring at all.
 *
 * WHY POPSTATE AND NOT A RENDER EFFECT. A `[pathname]` effect never fires when
 * only the query changes, so back from `?q=Abuja` to `?q=Lagos` would not be
 * seen at all. `popstate` fires on every traversal regardless, and by the time
 * it runs `location` already describes the entry being restored.
 *
 * WHY THE RETRY. On a traversal the restored page's markup is not on screen
 * yet, so the document is still short and a single `scrollTo(502)` clamps to
 * whatever currently fits and leaves the reader part-way up. That is precisely
 * the 502-to-153 measurement above. It re-applies for a few frames until the
 * document is tall enough to hold the position, then stops. Bounded, so a
 * genuinely shorter page settles instead of retrying for ever.
 *
 * It also stamps each history entry (`noteEntry`), because this is the one
 * component mounted on every screen in the app. See `lib/ui/history.ts` for
 * why back needed a stamp at all.
 */

const STORE_KEY = "nf_scroll_positions";
/** Positions remembered per tab. Enough for a deep hunt, not enough to bloat. */
const MAX_ENTRIES = 40;
/**
 * How long a restore may keep trying, in ms.
 *
 * MEASURED, NOT GUESSED. The first version of this budget was 40 animation
 * frames, about 660ms, and it failed on the real page: coming back to
 * `/search` the router still has to fetch and render the results, so for most
 * of that window the document was one viewport tall and every `scrollTo(1384)`
 * clamped to nothing. The budget ran out, the results then arrived 2500px
 * tall, and the reader was left at the top. Left at scrollY 1384, returned to
 * 242. Three seconds covers a cold RSC fetch on a slow connection and is
 * bounded, so a page that genuinely got shorter settles instead of thrashing.
 */
const RESTORE_BUDGET_MS = 3000;
/**
 * Frames the position must hold before the restore lets go. One frame is not
 * enough: the router does its own scroll handling on a traversal and can move
 * the page immediately after we set it.
 */
const SETTLED_FRAMES = 3;
/**
 * How long after a traversal the push handler stays out of the way, in ms.
 * `popstate` runs before React re-renders, so the flag is always already set
 * by the time the `[pathname]` effect looks at it.
 */
const POP_GRACE_MS = 700;

/**
 * How long a scrolling CHAIN stays open with no further movement, in ms.
 *
 * ONLY A PERSON'S SCROLL IS WORTH REMEMBERING, and getting this wrong was the
 * second bug this component produced, entirely separate from the first.
 * Recording every scroll event looked obviously right and was not: tapping a
 * listing card fires one scroll event to an unrelated position WHILE
 * `location` still says `/search`, with no `scrollTo` behind it and no change
 * in document height, so it is neither a clamp nor anything the reader did.
 * Traced on the real page: leave the search at scrollY 1320, and one event
 * later the stored position for that exact URL is 454. Coming back then
 * restored 454, perfectly correctly. The restore was never the problem.
 *
 * A window measured from the last GESTURE was not enough either, because a
 * person scrolls, pauses half a second, and then taps, which is well inside
 * any window long enough to cover a flick's momentum. So the window is short
 * and it is extended by SCROLLING rather than by gestures: momentum fires a
 * scroll event every frame and keeps its own chain alive, and a chain that has
 * gone quiet cannot be reopened by anything except another gesture.
 *
 * `touchstart` and `pointerdown` are deliberately NOT gestures. Tapping a link
 * is a touchstart, so counting one would re-admit the router's scroll through
 * the front door. Dragging fires `touchmove`; a wheel and a keyboard scroll
 * fire continuously while they move.
 */
const CHAIN_IDLE_MS = 400;

function currentUrl(): string {
  return window.location.pathname + window.location.search;
}

function readPositions(): Record<string, number> {
  try {
    const raw = window.sessionStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function writePositions(positions: Record<string, number>): void {
  try {
    const keys = Object.keys(positions);
    /* Oldest key first: JSON round-trips insertion order, and `remember`
       deletes a key before re-adding it, so the head really is the least
       recently touched screen. */
    if (keys.length > MAX_ENTRIES) {
      for (const key of keys.slice(0, keys.length - MAX_ENTRIES)) delete positions[key];
    }
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify(positions));
  } catch {
    /* Private browsing refuses session storage. Scroll memory is a courtesy,
       never a requirement, so it degrades to always landing at the top. */
  }
}

export function ScrollToTop() {
  const pathname = usePathname();
  const poppedAt = useRef(0);
  /* The position a traversal is waiting to put back, until the page it
     belongs to has committed (see the layout effect below). */
  const pendingRestore = useRef<{ url: string; target: number } | null>(null);
  /* The path React has on screen, which `popstate` cannot read from `location`
     (by then it already names the entry being returned to). */
  const committedPath = useRef(pathname);

  useEffect(() => {
    noteEntry();

    let frame = 0;
    /* While this is in the future a restore is in progress: saving is paused
       so the clamped intermediate positions do not overwrite the real one. */
    let restoreUntil = 0;

    const remember = () => {
      frame = 0;
      const positions = readPositions();
      const url = currentUrl();
      const next = Math.round(window.scrollY);

      /*
       * Second guard on the same failure, for the case the gesture window
       * cannot catch: a flick, then a tap on a link inside two and a half
       * seconds. A position pinned to the very bottom of the document that is
       * SMALLER than what is already stored is the signature of a clamp, not
       * of a reader. Refusing it costs nothing even when it is genuine,
       * because restoring the larger value onto a shorter page clamps to that
       * same bottom anyway.
       */
      const bottom = document.documentElement.scrollHeight - window.innerHeight;
      const previous = positions[url];
      if (
        typeof previous === "number" &&
        next < previous &&
        next >= bottom - 2
      ) {
        return;
      }

      delete positions[url];
      positions[url] = next;
      writePositions(positions);
    };

    /* While this is in the future, movement is the reader's own. Opened by a
       gesture, kept open by the movement it causes. */
    let chainUntil = 0;
    const openChain = () => {
      chainUntil = Date.now() + CHAIN_IDLE_MS;
    };

    /* rAF-throttled: scrolling fires dozens of times a second and every save
       is a JSON stringify into session storage. */
    const onScroll = () => {
      const now = Date.now();
      if (now < restoreUntil) return;
      if (now >= chainUntil) return;
      chainUntil = now + CHAIN_IDLE_MS;
      if (frame) return;
      frame = window.requestAnimationFrame(remember);
    };

    const restore = (target: number) => {
      const deadline = Date.now() + RESTORE_BUDGET_MS;
      restoreUntil = deadline;
      let settled = 0;

      const step = () => {
        if (restoreUntil !== deadline) return; /* superseded or cancelled */
        /* The page being returned to is not in the document yet: scrolling
           now would move the page being LEFT. Wait for the commit. */
        if (pendingRestore.current) {
          if (Date.now() > deadline) {
            restoreUntil = 0;
            return;
          }
          window.requestAnimationFrame(step);
          return;
        }
        if (Date.now() > deadline) {
          restoreUntil = 0;
          return;
        }

        /* Only ask for a position the document can actually hold. Asking while
           it is still one viewport tall clamps to the top, and a clamp is
           indistinguishable from success if you only check once. */
        const reachable =
          document.documentElement.scrollHeight - window.innerHeight >= target - 2;
        if (reachable) {
          window.scrollTo({ top: target, left: 0, behavior: "instant" as ScrollBehavior });
          settled = Math.abs(window.scrollY - target) <= 2 ? settled + 1 : 0;
          if (settled >= SETTLED_FRAMES) {
            restoreUntil = 0;
            return;
          }
        }
        window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step);
    };

    /* A deliberate scroll always wins. Nobody should have to fight the page
       for three seconds because it decided where they wanted to be. */
    const cancelRestore = () => {
      restoreUntil = 0;
    };

    const onPopState = () => {
      poppedAt.current = Date.now();
      noteEntry();
      const target = readPositions()[currentUrl()];
      /* Only a traversal to another PATH waits for its page to commit; a
         query-only one (`?q=Lagos` back to `?q=Abuja`) is the same page. */
      const want = typeof target === "number" && target > 0 ? target : 0;
      const otherPage = window.location.pathname !== committedPath.current;
      pendingRestore.current = otherPage ? { url: currentUrl(), target: want } : null;
      if (want > 0) restore(want);
      /* To the top: for another page, in the layout effect once it is in the
         document (scrolling now would jump the page being left); for the same
         page, now. */
      else if (!otherPage) window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    };

    /* One set of listeners doing two jobs: they mark a scroll as the reader's
       own, and they call off a restore in progress, because a person who has
       started moving the page has overruled wherever it was going. */
    const onGesture = () => {
      openChain();
      cancelRestore();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onPopState);
    window.addEventListener("wheel", onGesture, { passive: true });
    window.addEventListener("touchmove", onGesture, { passive: true });
    window.addEventListener("keydown", onGesture);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      restoreUntil = 0;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("wheel", onGesture);
      window.removeEventListener("touchmove", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, []);

  /*
   * BACK LANDS IN PLACE ON ITS FIRST FRAME (Agent FEEL, 13 November 2026).
   *
   * `popstate` fires while the page being left is still in the document, so
   * the restore above can only start trying on the next animation frame, and
   * measured on a production build the page being returned to was drawn ONE
   * FRAME at the top before it jumped to where it was left (/search: scrollY 0
   * at 105ms, 900 at 121ms). A layout effect runs after React has put the
   * returning page in the document and before the browser paints it (and
   * inside the view transition's update, so its "new" picture is taken in
   * place). Here the position is put back synchronously when the page is
   * already tall enough; the rAF loop above still finishes anything that
   * arrives later.
   */
  useLayoutEffect(() => {
    const changed = committedPath.current !== pathname;
    committedPath.current = pathname;
    let pending = pendingRestore.current;
    /* WEBKIT ORDER. The router can draw the returning page before this
       component has heard `popstate`, so nothing is pending yet. A returned-to
       entry is already stamped (a push is not, until it paints), so it is a
       traversal all the same, and its position is put back here. */
    /* `location` must already name this page: on a push the router writes the
       new entry after this effect, so the stamp and the address read here
       would still be the page being left. */
    if (!pending && changed && window.location.pathname === pathname && entryStamped()) {
      const target = readPositions()[currentUrl()];
      if (typeof target === "number" && target > 0) {
        pending = { url: currentUrl(), target };
        poppedAt.current = Date.now();
      }
    }
    if (!pending) return;
    pendingRestore.current = null;
    /* Somewhere else was reached instead: nothing to put back. */
    if (pending.url !== currentUrl()) return;
    /* Grace restarts at the commit, so a slow page is not then sent to the top
       by the push handler below. */
    poppedAt.current = Date.now();
    const reachable = document.documentElement.scrollHeight - window.innerHeight >= pending.target - 2;
    if (pending.target === 0 || reachable) {
      window.scrollTo({ top: pending.target, left: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [pathname]);

  /* A push lands at the top. A traversal is `popstate`'s to handle, and it has
     already run by the time this fires. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    noteEntry();
    if (Date.now() - poppedAt.current < POP_GRACE_MS) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return null;
}
