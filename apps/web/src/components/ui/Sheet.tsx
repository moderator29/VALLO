"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode, RefObject } from "react";
import { useOverlay } from "@/lib/ui/use-overlay";
import { useSheetHistory } from "@/lib/ui/use-sheet-history";
import { useClientMount } from "@/lib/ui/client-mount";
import { motionQuiet } from "@/lib/motion/gate";
import { isDataSaver } from "@/lib/ui/data-saver";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";

/**
 * The bottom sheet.
 *
 * There were eight hand-rolled sheets on this platform and not one of them had
 * a drag handle, a detent, spring physics, drag-to-dismiss or a focus trap.
 * Several declared `aria-modal="true"` while trapping nothing, which is worse
 * than not claiming it. Two never locked body scroll, so the page behind them
 * moved under your finger. All of them animated in with an 18px fade.
 *
 * On iOS that last detail is the single clearest tell that a screen is a web
 * page rather than an app: real sheets come up from the edge, can be thrown
 * back down, and stop at detents.
 *
 * What this owns, so no call site has to think about it again:
 *   - slide from the bottom edge on a spring, not a fade
 *   - a drag handle that actually drags, tracking the finger 1:1
 *   - detents, with the nearest one chosen on release by position AND velocity,
 *     so a fast flick dismisses even from near the top
 *   - drag-to-dismiss past the lowest detent
 *   - a focus trap, focus restoration, and Escape
 *   - body scroll lock
 *   - the home-indicator inset
 *
 * The last four of those are NOT written here. Escape, the Tab trap, the
 * counted scroll lock and the focus return all come from
 * `lib/ui/use-overlay`, which is the one implementation the whole platform
 * shares. This file kept its own for a while and the two disagreed in the way
 * that matters: this one set `body.style.overflow` outright, so a sheet opened
 * over a drawer handed scrolling back to the page underneath the moment the
 * sheet closed, while the drawer was still up. The hook counts its openers.
 *
 * What is still local is the FIRST focus. This sheet has always focused its
 * first control with `preventScroll`, because a sheet that scrolls the page
 * behind it as it opens is exactly the tell this primitive exists to remove,
 * and the hook has no reason to know that.
 */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * THE HEIGHT OF WHAT THE PERSON CAN ACTUALLY SEE, which is not `innerHeight`.
 *
 * `window.innerHeight` is the LAYOUT viewport. On iOS and on Android Chrome the
 * software keyboard does not change it: it slides a panel over the bottom of
 * the page and the number stays exactly what it was. `visualViewport.height` is
 * the part still visible above the keyboard, and it is the number every
 * calculation in this file wants.
 *
 * The detents are fractions of "the screen", and the dismissal threshold is the
 * lowest detent plus twelve per cent of "the screen". With a keyboard up and
 * `innerHeight` in hand, both are computed against a viewport that is roughly
 * half hidden, so the threshold sits well below the visible area: the sheet
 * cannot be dragged far enough to reach it, and drag-to-dismiss stops working
 * at the moment a finger is already near the bottom of the screen.
 *
 * The wallet's withdraw and transfer drawers are a form sheet with a focused
 * amount field, which means the keyboard is up for the whole of the
 * interaction. This is not an edge case on those two screens, it is the only
 * case.
 *
 * `innerHeight` stays as the fallback because `visualViewport` is absent in
 * jsdom and in older WebViews, and on a desktop browser the two agree.
 *
 * NOT VERIFIED ON A REAL DEVICE. The finding this closes says the same thing
 * about itself, and it has not been run on a phone with a keyboard up.
 * What is verified is that the arithmetic now reads the visible height where a
 * visible height exists.
 */
function viewportHeight(): number {
  if (typeof window === "undefined") return 0;
  return window.visualViewport?.height ?? window.innerHeight;
}

export function Sheet({
  open,
  onOpenChange,
  title,
  /**
   * Fractions of viewport height, ascending. `[0.5, 0.92]` gives a half-height
   * resting position and a near-full one. The sheet opens at the LAST detent.
   */
  detents = [0.92],
  /** Hides the visible title while keeping it as the accessible name. */
  hideTitle = false,
  description,
  initialFocus,
  footer,
  closeLabel,
  reset,
  apply,
  headAction,
  fullPage = false,
  sideOnWide = false,
  card = false,
  className,
  testId,
  children,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  detents?: number[];
  hideTitle?: boolean;
  /**
   * GRADE 1: one sentence of why, under the title, the way every reference
   * sheet explains itself ("Make sure your name matches your ID"). Plain text.
   */
  description?: string;
  /**
   * THE FILTER SHEET'S ANATOMY, as three opt-in props. The search render
   * draws a header row (title left, a glass close square right) and a footer
   * row (Reset in glass beside Apply in the lit primary). Nothing renders
   * unless asked, so the thirty-nine sheets standing on this file keep their
   * look.
   *
   * `closeLabel` is the close control's accessible name and its on switch: a
   * string rather than a boolean because an unlabelled X is invisible to a
   * screen reader and this platform ships four locales.
   */
  /**
   * `null` draws no close control at all, for a sheet whose own full-width
   * bar is the way out (the action sheet's Done). Left out, a sheet gets the
   * default X; the swipe, the scrim, Escape and Back close it either way.
   */
  closeLabel?: string | null;
  /** The footer's quiet action. Label is the localised word. */
  reset?: { label: string; onClick(): void; disabled?: boolean };
  /** The footer's lit primary. `loading` keeps the label and shows the line. */
  apply?: { label: string; onClick(): void; disabled?: boolean; loading?: boolean };
  /**
   * What the keyboard lands on when the sheet opens. Defaults to the first
   * focusable node, which is very often the wrong one. See the note on the
   * focus effect below.
   */
  initialFocus?: RefObject<HTMLElement | null>;
  footer?: ReactNode;
  /**
   * A control at the right of the header row, with `closeLabel`: the filter
   * sheet's Reset, to the founder's reference (search-map, 13 October 2026).
   * When it is given, the close moves to the left and the title sits in the
   * middle, the order that reference draws; without it the header is as
   * every other sheet has it.
   */
  headAction?: ReactNode;
  /**
   * The whole screen rather than a sheet over part of it, for the dialogs that
   * are designed as a page: a long searchable picker, the filters, a report
   * form, closing an account. It is the same component so those get the same
   * drag and flick to close, Back, Escape, focus trap and return, scroll lock
   * and safe areas as every other sheet; only the geometry changes. The
   * detents are ignored: a page has one height.
   */
  fullPage?: boolean;
  /**
   * With `fullPage`: on a wide screen, a panel docked to the right edge
   * rather than the whole window, which is how the filter drawers have always
   * sat on a tablet or a desktop. A phone still gets the page.
   */
  sideOnWide?: boolean;
  /**
   * A CARD IN THE MIDDLE OF THE SCREEN, on every width, for the moments that
   * are an answer rather than a task: the success sheet. It keeps everything
   * else this file owns (portal, backdrop, focus trap and return, Escape,
   * Back, scroll lock); it has no grip and no drag, because a card that is
   * not attached to an edge has nowhere to be thrown to. It scales and fades
   * in, and under reduced motion it simply appears. The detents are ignored.
   */
  card?: boolean;
  /** Extra classes on the dialog surface, for a composed sheet's own dress. */
  className?: string;
  /** Put on the dialog element itself, for a spec to find. */
  testId?: string;
  children: ReactNode;
}) {
  /* GRADE 1 (survey SW3): every sheet has a close X unless it is a centred
     card (a moment with its own Continue). A caller's own words still win. */
  closeLabel = closeLabel === null ? undefined : (closeLabel ?? (card ? undefined : "Close"));
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  // Drag state is a ref, not state: it changes every pointermove and must not
  // drive a React render per frame.
  const drag = useRef<{ startY: number; startOffset: number; lastY: number; lastT: number; v: number } | null>(
    null,
  );
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  /*
   * `entered` is why the sheet slides instead of appearing.
   *
   * The surface is only in the DOM while open, so it arrives already at its
   * final state. A CSS transition needs a frame at the START value to animate
   * from; with none, the browser paints the end state immediately and the
   * spring never runs - the sheet just materialises, which is precisely the
   * thing this primitive exists to stop.
   *
   * So it mounts closed and flips open on the next animation frame, giving the
   * transition its starting frame. Two frames rather than one because a single
   * rAF can still land inside the same style recalculation in Safari.
   */
  const [entered, setEntered] = useState(false);

  /*
   * The client latch for `createPortal`, and it was the FIFTH hand-rolled copy.
   *
   * `createPortal` needs `document.body`, which does not exist while rendering
   * on the server, so this component must return `null` on the server AND on
   * the first client render - if the two disagree, React throws a hydration
   * mismatch on the most-used overlay in the product.
   *
   * This stood here as `useState(false)` plus `useEffect(() => setMounted(true))`
   * under an `eslint-disable` for `react-hooks/set-state-in-effect`, with a long
   * argument that the rule was right in general and wrong here. The argument was
   * sound about the REQUIREMENT and wrong about the only way to meet it:
   * `useSyncExternalStore` asks exactly this question through the channel React
   * provides for it, with no state to set, no second render scheduled and no
   * disable comment to maintain. Four other components had already moved.
   *
   * The disable is gone with the code it excused, which is the point worth
   * keeping: a well-argued suppression is still a suppression, and four files
   * agreeing on a better answer is stronger evidence than any argument written
   * beside the worse one.
   */
  const mounted = useClientMount();

  /*
   * RESETTING ON `open` HAPPENS DURING RENDER NOW, NOT IN TWO EFFECTS.
   *
   * `setEntered(false)` sat in the entrance effect and `setOffset(0)` sat in the
   * focus effect, so opening the sheet took an extra render pass each and the
   * two halves of one reset lived sixty lines apart. Both are the same thing:
   * state that has to go back to its initial value when a PROP changes, which
   * React documents as an adjustment made while rendering, guarded by comparing
   * against the previous value. It is cheaper than an effect - React re-runs
   * this component before touching the DOM, so nothing paints the stale value -
   * and it puts the whole reset in one place where it can be read at once.
   *
   * The guard is what makes it safe: without `prevOpen !== open` this is an
   * infinite render loop.
   *
   * `entered` must be false at the moment `open` becomes true, and that is the
   * load-bearing half. The transition needs a frame at the start value to
   * animate from; see the note above. Doing it here rather than in the effect
   * below also closes the gap where a fast reopen could have committed
   * `entered: true` from the previous cycle before the reset ran.
   */
  /*
   * THE LEAVE HAS TO BE SEEN (MOTION_SYSTEM "Sheet exit": `leave` 240ms;
   * Session 3, R2, auditor A7 N1). The sheet used to return null the instant
   * `open` turned false, so the exit transition the stylesheet declares had no
   * element to run on. `leaving` keeps it mounted, closed, while it plays:
   *
   *   - set when `open` goes true to false, in the same render-time adjustment
   *     as `entered`, and only when motion is allowed: reduced motion, Calm,
   *     Off and data saving unmount at once, as before;
   *   - cleared when `open` comes back (a re-open during the leave takes the
   *     same node back up from where it is), or when the panel's transform
   *     transition ends, or a fallback timer equal to the longest transition
   *     it is running plus a margin fires, so a missed event never strands a
   *     sheet on screen (the effect further down).
   *
   * While it is leaving it is `inert` and its scrim lets clicks through: focus
   * and the screen reader are already back on the page (the overlay hook
   * returns focus to the opener at the moment `open` changes, not when this
   * ends), and the person can act on the page behind a sheet that is still
   * sliding away.
   */
  const [leaving, setLeaving] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setEntered(false);
    setOffset(0);
    setLeaving(!open && !motionQuiet() && !isDataSaver());
  }
  const closing = !open && leaving;

  /*
   * WHAT A LEAVING SHEET SHOWS (auditor A8). Callers often clear the state a
   * sheet's content reads in the same update that closes it (`{asking ?
   * <Panel/> : null}`, a body that becomes ""), so the leave would slide away
   * an empty card. While open, the sheet keeps the last title, content, footer
   * and actions it was given (a render-time update, the same idiom as
   * `prevOpen` above); while leaving, it draws those instead of the cleared
   * ones. It is inert by then, so nothing held can be pressed.
   */
  const live = { title, children, footer, reset, apply, headAction };
  const [held, setHeld] = useState(live);
  if (
    open &&
    (held.title !== title ||
      held.children !== children ||
      held.footer !== footer ||
      held.reset !== reset ||
      held.apply !== apply ||
      held.headAction !== headAction)
  ) {
    setHeld(live);
  }
  const face = closing ? held : live;

  useEffect(() => {
    if (open || !leaving) return;
    const panel = sheetRef.current;
    const finish = () => setLeaving(false);
    if (!panel) {
      const now = window.setTimeout(finish, 0);
      return () => window.clearTimeout(now);
    }
    /* The longest the panel will run: each property's duration plus its delay,
       read from the computed style (this effect runs after the closed state is
       applied), so a card sheet's 240ms and a page sheet's 240ms are both
       honoured without this file knowing either. */
    const style = getComputedStyle(panel);
    const seconds = (list: string) => list.split(",").map((part) => Number.parseFloat(part) || 0);
    const durations = seconds(style.transitionDuration);
    const delays = seconds(style.transitionDelay);
    const longest = Math.max(0, ...durations.map((d, i) => d + (delays[i % delays.length] ?? 0))) * 1000;
    const onEnd = (event: TransitionEvent) => {
      if (event.target === panel && event.propertyName === "transform") finish();
    };
    panel.addEventListener("transitionend", onEnd);
    const timer = window.setTimeout(finish, Math.min(1500, longest + 80));
    return () => {
      panel.removeEventListener("transitionend", onEnd);
      window.clearTimeout(timer);
    };
  }, [open, leaving]);

  useEffect(() => {
    if (!open) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [open]);

  /*
   * The detents as a stable primitive, and this is not tidiness.
   *
   * `detents` is a prop with an ARRAY DEFAULT, so an unspecified one is a fresh
   * `[0.92]` on every render and a specified one is usually an inline literal at
   * the call site, which is also fresh every render. Anything memoised on it is
   * therefore memoised on nothing.
   *
   * That was harmless while `heights` was only called from `onPointerUp`. It
   * stopped being harmless the moment the visual-viewport effect below took it
   * as a dependency: `setOffset` and `setDragging` re-render on every
   * pointermove, so the effect would have removed and re-added two listeners on
   * every frame of every drag. A string of the sorted values compares by value,
   * so `heights` is stable while the detents are, and the subscription happens
   * once per open.
   */
  const detentKey = fullPage || card ? "1" : [...detents].sort((a, b) => a - b).join(",");

  const heights = useCallback(() => {
    const vh = viewportHeight();
    const sorted = detentKey ? detentKey.split(",").map(Number) : [];
    const tallest = sorted[sorted.length - 1] ?? 0.92;
    // Offset 0 is the tallest detent. A shorter detent sits further DOWN, so
    // its offset is the difference in height, in pixels.
    return { vh, offsets: sorted.map((d) => (tallest - d) * vh).sort((a, b) => a - b) };
  }, [detentKey]);

  /* Escape, the Tab trap, the counted scroll lock and the focus return, from
     the one shared implementation. `autoFocus` is off because the effect below
     needs `preventScroll`, which the hook does not pass. */
  /*
   * STABLE ACROSS RENDERS, WHATEVER THE CALLER PASSES.
   *
   * `useOverlay` re-runs its effect when `onClose` changes, and its cleanup
   * hands focus back to the opener. A caller writing `onOpenChange={(o) => …}`
   * inline gives a new function on every render, so every re-render of the
   * page under an open sheet threw focus out of it onto the opener. Found on
   * the post menu, the comments sheet and the delete drawer: open, and the
   * keyboard was already back on the page behind.
   */
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);
  const close = useCallback(() => onOpenChangeRef.current(false), []);
  useOverlay({ open, onClose: close, panelRef: sheetRef, autoFocus: false });
  /* UX-19: the browser's Back closes the sheet instead of leaving the page. */
  useSheetHistory(open, titleId, close);

  /*
   * First focus, and the drag offset reset.
   *
   * `restoreFocus` is still read on the way out, and it is not a duplicate of
   * what the hook does. The hook restores to whatever was focused when it ran;
   * this restores across the open/closed boundary of a sheet that stays mounted
   * while closed. Both land on the opener, and whichever runs second finds
   * focus already there and moves nothing.
   */
  useEffect(() => {
    if (!open) {
      restoreFocus.current?.focus?.();
      restoreFocus.current = null;
      return;
    }
    restoreFocus.current = document.activeElement as HTMLElement | null;
    const node = sheetRef.current;
    if (!node) return;
    /*
     * FIRST FOCUS IS THE SHEET'S OPENING SENTENCE, and the default was reading
     * out the exit.
     *
     * `querySelector(FOCUSABLE)` returns the first focusable node in DOM order,
     * and in every drawer on this platform that is the Close button, because
     * Close sits in the header and the header comes first. So opening "Add
     * money" put the keyboard on Close, and a screen reader said "Add money to
     * your wallet, dialog" and then "Close, button": the sheet announces what
     * it is for and then offers to go away.
     *
     * `initialFocus` lets the call site name the node instead. For a form sheet
     * it is the first field; for a result sheet it is the primary action. The
     * default is unchanged, because a sheet that has not thought about it is
     * still better off trapping focus somewhere inside itself than leaving it
     * on the page behind.
     *
     * The ref may be attached to a node that has not rendered, or to one that
     * is disabled while a request is in flight, so this checks the node is
     * still focusable before using it rather than focusing nothing.
     */
    const wanted = initialFocus?.current;
    /*
     * Grade 1: the sheet's own content first, not its close X. A candidate
     * is only taken if focus really lands on it: the first focusable node in
     * a body is often a visually hidden control (a custom radio's input, a
     * file input), and `focus()` on a node that is not rendered does nothing
     * and says nothing, which left focus on the page behind the sheet. So
     * each candidate is tried in order (the named node, the body's own
     * controls, then anything in the sheet) and the sheet itself is the floor.
     */
    const candidates: HTMLElement[] = [
      ...(wanted && node.contains(wanted) && !wanted.hasAttribute("disabled") ? [wanted] : []),
      ...node.querySelectorAll<HTMLElement>(`.nf-sheet__body :is(${FOCUSABLE})`),
      ...node.querySelectorAll<HTMLElement>(FOCUSABLE),
    ];
    let landed = false;
    for (const candidate of candidates) {
      if (candidate.getClientRects().length === 0) continue;
      candidate.focus({ preventScroll: true });
      if (document.activeElement === candidate) {
        landed = true;
        break;
      }
    }
    if (!landed) node.focus({ preventScroll: true });
    /* `mounted` too: a sheet that is open during hydration renders nothing
       on that first pass (the portal latch), so the node only exists once
       `mounted` flips, and without it here first focus never happened. */
  }, [open, mounted, initialFocus]);

  /*
   * THE KEYBOARD CHANGES THE VIEWPORT UNDER A SETTLED SHEET.
   *
   * `heights()` reads the visible height every time it is called, so a drag
   * that starts after the keyboard is already up is computed correctly. What it
   * cannot fix on its own is a sheet that settled at a detent BEFORE the
   * keyboard appeared: its offset is a pixel value derived from the old height,
   * and it stays there while the viewport shrinks around it, so a half-height
   * sheet becomes a nearly-full one or slides most of the way off the bottom.
   *
   * On a focused field that is the ordinary sequence: the sheet opens, it
   * settles, the field takes focus, the keyboard comes up.
   *
   * So it re-settles to the nearest detent for the new height. `scroll` is
   * listened for as well as `resize` because iOS fires only `scroll` when the
   * visual viewport is panned rather than resized, and the offsets move either
   * way. Nothing here runs when the sheet is closed or while a finger is down:
   * re-settling mid-drag would fight the drag.
   */
  useEffect(() => {
    const vv = typeof window === "undefined" ? null : window.visualViewport;
    if (!open || !vv) return;
    const resettle = () => {
      if (drag.current) return;
      const { offsets } = heights();
      setOffset((current) =>
        offsets.reduce((best, o) => (Math.abs(o - current) < Math.abs(best - current) ? o : best), 0),
      );
    };
    vv.addEventListener("resize", resettle);
    vv.addEventListener("scroll", resettle);
    return () => {
      vv.removeEventListener("resize", resettle);
      vv.removeEventListener("scroll", resettle);
    };
  }, [open, heights]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      startY: e.clientY,
      startOffset: offset,
      lastY: e.clientY,
      lastT: e.timeStamp,
      v: 0,
    };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = (e.clientY - d.lastY) / dt; // px per ms, positive = downward
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    // Upward past the tallest detent resists rather than tearing off the top.
    const raw = d.startOffset + (e.clientY - d.startY);
    setOffset(raw < 0 ? raw / 4 : raw);
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;

    const { vh, offsets } = heights();
    const dismissAt = (offsets[offsets.length - 1] ?? 0) + vh * 0.12;

    // A fast downward flick dismisses from anywhere. Velocity matters as much
    // as position, which is what makes a sheet feel thrown rather than dragged.
    if (d.v > 0.7 || offset > dismissAt) {
      onOpenChange(false);
      return;
    }
    // Otherwise settle on the nearest detent, biased by the direction of travel.
    const projected = offset + d.v * 90;
    const nearest = offsets.reduce((best, o) =>
      Math.abs(o - projected) < Math.abs(best - projected) ? o : best,
    );
    setOffset(nearest);
  };

  if (!mounted || (!open && !leaving)) return null;

  return createPortal(
    <>
      <div
        className="nf-sheet-backdrop"
        data-open={entered}
        data-closing={closing || undefined}
        inert={closing || undefined}
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={[
          fullPage
            ? `nf-sheet nf-sheet--page${sideOnWide ? " nf-sheet--side" : ""} outline-none`
            : card
              ? "nf-sheet nf-sheet--card outline-none"
              : "nf-sheet outline-none",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        data-testid={testId}
        data-open={entered}
        data-closing={closing || undefined}
        inert={closing || undefined}
        data-dragging={dragging || undefined}
        /*
         * The upward resistance above is REAL now, and it was dead code.
         *
         * `onPointerMove` computes a damped negative offset when the sheet is
         * dragged past its tallest detent, and this line clamped it to zero, so
         * the resistance the comment described resisted nothing: the surface
         * simply did not move. A rubber band that does not band is worse than
         * none, because the sheet reads as stuck.
         *
         * The clamp is kept as a floor on the DAMPED value rather than on the
         * raw one, so the surface can lift by at most a quarter of the overdrag
         * and cannot be torn off the top of the screen.
         */
        style={{ ["--nf-sheet-y" as string]: `${Math.max(-56, offset)}px` }}
      >
        {/*
          The grip owns the drag. Putting it on the whole surface would fight
          every scrollable list and every slider inside the sheet.
        */}
        {card ? null : (
          <div
            className="nf-sheet__grip"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-hidden="true"
          />
        )}
        {closeLabel && face.headAction ? (
          <div className="nf-sheet__head px-gutter">
            <button
              type="button"
              aria-label={closeLabel}
              onClick={() => onOpenChange(false)}
              className="nf-icon-btn nf-icon-btn--round"
            >
              <UiIcon name="close" size={20} />
            </button>
            <h2
              id={titleId}
              className={
                hideTitle
                  ? "sr-only"
                  : "min-w-0 flex-1 truncate text-center text-[length:var(--nf-text-body-lg)] font-semibold tracking-tight text-[var(--nf-content-primary)]"
              }
            >
              {face.title}
            </h2>
            {face.headAction}
          </div>
        ) : closeLabel ? (
          <div className="nf-sheet__head px-gutter">
            <h2
              id={titleId}
              className={
                hideTitle
                  ? "sr-only"
                  : "min-w-0 text-[length:var(--nf-text-h4)] font-semibold tracking-tight text-[var(--nf-content-primary)]"
              }
            >
              {face.title}
            </h2>
            {/* The sheet's close is a header control, so it is the 44px round
                control every header draws (handoff Stage 2, "round header
                controls"; the same material as `BackControl`): it was the
                glass square, the one square left in a header. The title is
                the Title rung at 600, not bold (north star 5). */}
            <button
              type="button"
              aria-label={closeLabel}
              onClick={() => onOpenChange(false)}
              className="nf-icon-btn nf-icon-btn--round"
            >
              <UiIcon name="close" size={20} />
            </button>
          </div>
        ) : (
          <h2
            id={titleId}
            className={
              hideTitle
                ? "sr-only"
                : "shrink-0 px-gutter pb-sm text-[length:var(--nf-text-body-lg)] font-semibold tracking-tight text-[var(--nf-content-primary)]"
            }
          >
            {face.title}
          </h2>
        )}
        {description && !hideTitle ? <p className="nf-sheet__desc px-gutter">{description}</p> : null}
        <div className="nf-sheet__body px-gutter pb-lg">{face.children}</div>
        {face.reset || face.apply ? (
          <div className="nf-sheet__foot px-gutter">
            {face.reset ? (
              <Button variant="glass" size="lg" full disabled={face.reset.disabled} onClick={face.reset.onClick}>
                {face.reset.label}
              </Button>
            ) : (
              <span aria-hidden="true" />
            )}
            {face.apply ? (
              <Button
                variant="primary"
                size="lg"
                full
                glow
                disabled={face.apply.disabled}
                loading={face.apply.loading}
                onClick={face.apply.onClick}
              >
                {face.apply.label}
              </Button>
            ) : null}
          </div>
        ) : null}
        {face.footer ? <div className="shrink-0 px-gutter pb-md">{face.footer}</div> : null}
      </div>
    </>,
    document.body,
  );
}
