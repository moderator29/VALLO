"use client";

import { useEffect, useRef, type RefObject } from "react";
import { isTopOverlay, joinOverlay, leaveOverlay } from "@/lib/ui/overlay-registry";

/**
 * The four things every overlay owes the person using it.
 *
 * A sweep across all twenty-two overlays in this app found the same three
 * defects distributed almost at random: `AppShell`'s drawer and the site
 * `MobileMenu` carried `aria-modal` and no Escape handler at all, four sheets
 * let the page scroll behind them, and NOT ONE of the twenty-two trapped Tab.
 * Every one of them had been written by hand, which is why no two agreed.
 *
 * So this is one implementation, and the contract is:
 *
 *  1. **Escape closes.** An overlay a keyboard cannot leave is a trap.
 *  2. **The body does not scroll behind it.** The most common mobile bug in
 *     the world: you flick to dismiss a sheet and the page underneath moves.
 *     On iOS Safari that needs the body pinned, not only `overflow: hidden`
 *     (`lockBody`).
 *  3. **Tab stays inside.** Tabbing out of a modal into the page behind it
 *     leaves a screen reader reading content that is visually covered.
 *  4. **Focus comes back.** On close, focus returns to whatever opened the
 *     overlay, so the keyboard does not get dumped at the top of the document.
 *
 * NOT EVERY OVERLAY IS MODAL. A navigation menu that opens over the page and
 * does not hide it (`InnerNav`) must not lock the body, must not trap Tab and
 * must not pull focus away from where the person is. It passes `modal: false`
 * and keeps the two things that are still owed: Escape closes it (when focus
 * is inside it, or the Escape is Android Back's synthetic one), and it joins
 * the overlay registry, so the Android back button closes it too (a non-locking
 * overlay leaves no scroll lock for Back to find, which is why Back asks the
 * registry and not the lock). It makes no history entry, so the BROWSER's back
 * button is not part of this; that needs `use-sheet-history.ts`, deliberately
 * not used for a menu. A modal overlay (the default) behaves exactly as it
 * always has.
 *
 * The scroll lock counts openers rather than setting and clearing a flag,
 * because two overlays can legitimately be open at once (a sheet over a
 * drawer) and the naive version has the inner one restore scrolling when it
 * closes while the outer is still up.
 */

/** How many overlays currently want the body still. */
let lockCount = 0;
/** The body's own inline styles before the first lock, put back by the last release. */
let restore: Partial<Record<LockedStyle, string>> = {};
let restoreScrollY = 0;
/** The address the first lock was taken on: the scroll is put back only on the same page. */
let restoreHref = "";

const LOCKED_STYLES = ["overflow", "position", "top", "left", "right", "width", "paddingRight"] as const;
type LockedStyle = (typeof LOCKED_STYLES)[number];

/**
 * THE LOCK HOLDS ON iOS SAFARI (D49.3). `overflow: hidden` on the body alone
 * is ignored by iOS Safari: the page behind a sheet still scrolls under a
 * finger, which is the bug this hook exists to prevent, and every sheet
 * inherited it. So the body is also pinned in place: `position: fixed` at
 * `top: -scrollY`, full width, which iOS does honour, and the page stays
 * exactly where it was on screen. The last release unpins it and scrolls the
 * window back to the same place, so closing a sheet never jumps the page to
 * the top. Where the page had a classic scrollbar, its width is padded back
 * so the content does not shift sideways when it disappears.
 */
export function lockBody(): () => void {
  if (lockCount === 0) {
    const body = document.body;
    restoreScrollY = window.scrollY;
    restoreHref = window.location.href;
    restore = Object.fromEntries(LOCKED_STYLES.map((name) => [name, body.style[name]]));
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${restoreScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
  }
  lockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount > 0) return;
    const body = document.body;
    for (const name of LOCKED_STYLES) body.style[name] = restore[name] ?? "";
    /* Only on the page it was taken from (A9). A sheet closed by a link
       inside it releases after the route has changed, and scrolling the new
       page to the old page's position dropped the person mid-page. */
    if (window.location.href === restoreHref) window.scrollTo(0, restoreScrollY);
  };
}

/** Everything focusable inside a container, in document order. */
function focusableWithin(root: HTMLElement): HTMLElement[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type=hidden])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");
  return [...root.querySelectorAll<HTMLElement>(selector)].filter((el) => {
    // Hidden nodes report zero-size rects, and a trap that cycles through
    // invisible controls is worse than no trap.
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

export function useOverlay({
  open,
  onClose,
  panelRef,
  /** Move focus into the panel on open. Off for a menu that owns its own. */
  autoFocus = true,
  /**
   * The default, and what every sheet, drawer and dialog is: the page behind
   * is locked, Tab is trapped and focus returns to the opener on close. Pass
   * `false` for a non-modal menu: no scroll lock, no Tab trap and no focus
   * handling (the menu moves its own), only Escape and Back.
   */
  modal = true,
}: {
  open: boolean;
  onClose: () => void;
  panelRef: RefObject<HTMLElement | null>;
  autoFocus?: boolean;
  modal?: boolean;
}): void {
  /* The latest close handler, read when Escape or Back fires. It is NOT a
     dependency of the effect below: most callers pass an inline arrow, which
     is a new function on every render, and as a dependency it tore the
     overlay down and set it up again on each render. The teardown hands focus
     back to the opener, so in a form inside an overlay (every StepFrame flow)
     the first keystroke re-rendered the form, focus jumped off the field and
     the next letter was lost (found 9 November 2026 in the listing wizard). */
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement as HTMLElement | null;
    const releaseScroll = modal ? lockBody() : () => {};

    const panel = panelRef.current;
    if (modal && autoFocus && panel) {
      const first = focusableWithin(panel)[0];
      (first ?? panel).focus?.();
    }

    const token = joinOverlay();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopOverlay(token)) return;
      if (event.key === "Escape") {
        /* A non-modal menu is open beside the page, so a real Escape is the
           menu's only while focus is inside it: from a field elsewhere it is
           that field's (clearing a search, closing its own popup), and a menu
           left open must not swallow it. Android's Back button dispatches a
           synthetic Escape (`lib/native/back-button.ts`), which is not trusted
           and is always meant for the top overlay. */
        if (!modal && event.isTrusted && !panelRef.current?.contains(document.activeElement)) return;
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (!modal || event.key !== "Tab") return;

      const root = panelRef.current;
      if (!root) return;
      const items = focusableWithin(root);
      if (items.length === 0) {
        // Nothing to land on, so keep focus on the panel rather than letting
        // it escape to the page underneath.
        event.preventDefault();
        root.focus?.();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !root.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !root.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      leaveOverlay(token);
      document.removeEventListener("keydown", onKeyDown, true);
      releaseScroll();
      /* A non-modal menu moved its own focus and took none from the page. */
      if (!modal) return;
      // Only take focus back if it is still somewhere in the overlay we are
      // tearing down; a close that deliberately moved focus elsewhere wins.
      /* The panel as it was opened when the ref has already been let go: an
         overlay that unmounts as it closes detaches its ref before this runs,
         and reading only the ref made every such close take focus back,
         including one that had deliberately moved it (the photo viewer
         handing focus to the photo the reader ended on). */
      const panelNow = panelRef.current ?? panel;
      const active = document.activeElement;
      if (!panelNow || !active || panelNow.contains(active) || active === document.body) {
        opener?.focus?.();
      }
    };
  }, [open, panelRef, autoFocus, modal]);
}
