"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { feedback } from "@/lib/ui/feedback";
import { SWIPE_REPLY_AT, lockAxis, swipeCommits, swipeTravel, type SwipeAxis, type SwipeSide } from "./swipe";

/**
 * A BUBBLE'S TWO GESTURES: hold it for the message menu, swipe it to reply
 * (founder, 11 October 2026). One element owns both, so they cannot fight.
 *
 *   HOLD: 450ms without moving opens the menu, as it always has; a right
 *   click (or the browser's own long-press menu) opens it at once.
 *
 *   SWIPE: on touch and pen only, so a mouse still selects text. A received
 *   bubble goes right and a sent one left; let go past about 56px and the
 *   message becomes the reply target, the same as Reply in the menu, with a
 *   light tap on a phone that can give one (`feedback("select")`, felt on
 *   the release that commits, never while the finger is still moving).
 *
 * The first 8px of movement decide what the gesture is (`swipe.ts`), and any
 * movement at all cancels the hold, so a swipe never opens the menu. A
 * vertical start is the thread scrolling: `touch-action: pan-y` leaves it to
 * the browser, which then cancels the pointer, and nothing here moves. The
 * bubble only ever moves by `transform`, and the thread's scroller clips its
 * own sides, so a swipe cannot scroll the thread sideways. A swipe that moved
 * the bubble swallows the click that ends it, so a link inside does not open.
 */

const LONG_PRESS_MS = 450;
/* A gesture that starts on a control that drags itself (a voice note's seek
   bar) belongs to that control: no hold, no swipe. One that starts on a group
   of photos that swipes sideways (`PhotoGroup`) scrolls the photos: it can
   still be held for the menu, but it never sets a reply. */
const OWN_CONTROL = "input, textarea, select, [role='slider']";
const OWN_SWIPE = "[data-swipe-own]";

type Gesture = { x: number; y: number; pointerId: number; axis: SwipeAxis; canSwipe: boolean };

export function BubbleGestures({
  side,
  className,
  onLongPress,
  onSwipeReply,
  isNew,
  children,
}: {
  side: SwipeSide;
  /** The bubble's own classes; this element is the bubble. */
  className: string;
  /** Opens the message menu. Absent (a bubble still on its way): no hold. */
  onLongPress?: () => void;
  /** Sets the reply target. Absent: no swipe. */
  onSwipeReply?: () => void;
  /** Arrived after the thread opened: drives the bubble entrance animation. */
  isNew?: boolean;
  children: ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const gesture = useRef<Gesture | null>(null);
  const pressTimer = useRef<number | null>(null);
  const swiped = useRef(false);

  const stopPress = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  const reset = () => {
    gesture.current = null;
    stopPress();
    setDx(0);
  };

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const from = event.target instanceof Element ? event.target : null;
    if (from?.closest(OWN_CONTROL)) return;
    swiped.current = false;
    gesture.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      axis: null,
      canSwipe: Boolean(onSwipeReply) && event.pointerType !== "mouse" && !from?.closest(OWN_SWIPE),
    };
    stopPress();
    if (onLongPress) {
      pressTimer.current = window.setTimeout(() => {
        pressTimer.current = null;
        gesture.current = null;
        setDx(0);
        /* The finger lifting after a hold must not also tap what is under it
           (a photo opening full screen behind the message menu). */
        swiped.current = true;
        onLongPress();
      }, LONG_PRESS_MS);
    }
  };

  const track = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || event.pointerId !== g.pointerId) return;
    const travelled = event.clientX - g.x;
    if (g.axis === null) {
      g.axis = lockAxis(travelled, event.clientY - g.y);
      if (g.axis === null) return;
      /* It moved: whatever this is, it is not a hold. */
      stopPress();
    }
    if (g.axis !== "x" || !g.canSwipe) return;
    swiped.current = true;
    setDx(swipeTravel(travelled, side));
  };

  const release = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    reset();
    if (!g || event.pointerId !== g.pointerId || g.axis !== "x" || !g.canSwipe || !onSwipeReply) return;
    if (!swipeCommits(event.clientX - g.x, side)) return;
    feedback("select");
    onSwipeReply();
  };

  const armed = Math.abs(dx) >= SWIPE_REPLY_AT;

  return (
    <div className="nf-swipe-reply" data-side={side}>
      {onSwipeReply ? (
        <span
          className="nf-swipe-reply__glyph"
          aria-hidden="true"
          data-armed={armed || undefined}
          style={dx === 0 ? undefined : { opacity: Math.min(1, Math.abs(dx) / SWIPE_REPLY_AT) }}
        >
          <UiIcon name="arrow-left" size={18} />
        </span>
      ) : null}
      <div
        className={className}
        data-new={isNew || undefined}
        data-swiping={dx !== 0 || undefined}
        style={dx === 0 ? undefined : { transform: `translateX(${dx}px)` }}
        onPointerDown={down}
        onPointerMove={track}
        onPointerUp={release}
        onPointerCancel={reset}
        onPointerLeave={(event) => {
          /* A mouse that leaves ends the hold; a finger keeps its bubble
             (touch is captured to it until it lifts). */
          if (event.pointerType === "mouse") reset();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          reset();
          onLongPress?.();
        }}
        onClickCapture={(event) => {
          if (!swiped.current) return;
          swiped.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {children}
      </div>
    </div>
  );
}
