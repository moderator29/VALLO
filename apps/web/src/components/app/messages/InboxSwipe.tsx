"use client";

import { useRef, useState, type ReactNode } from "react";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { lockAxis } from "./swipe";

/**
 * A CONVERSATION ROW'S SWIPE ACTIONS (Platform Grade 1, inbox polish).
 *
 * On touch, a row slides left to uncover its actions (Mark read, Archive),
 * rests open past `OPEN_AT`, and closes on a swipe back, on a tap on the row
 * or once an action is taken. A mouse or pen never starts it, and a vertical
 * start is the list scrolling (`touch-action: pan-y`), so the inbox scrolls
 * exactly as it did. A swipe that moved the row swallows the tap that ends
 * it, so the conversation does not open by accident.
 *
 * The same actions stay reachable without a swipe: a long press on the row,
 * or its More button (shown on hover on a desktop, and always reachable by
 * keyboard), opens the row's action sheet with exactly these actions
 * (Inbox.tsx builds both from one list). The uncovered buttons are hidden
 * from the tab order and from screen
 * readers while the row is shut. Only `transform` moves; reduced motion
 * snaps instead of gliding (messages-g1.css).
 */

export type SwipeAction = { key: string; label: string; icon: UiIconName; tone?: "brand" | "neutral"; run: () => void };

const ACTION_W = 68;
const OPEN_AT = 56;

export function InboxSwipe({ actions, children }: { actions: SwipeAction[]; children: ReactNode }) {
  const reveal = actions.length * ACTION_W;
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; base: number; axis: "x" | "y" | null; id: number } | null>(null);
  const moved = useRef(false);
  const open = dx <= -OPEN_AT;

  if (actions.length === 0) return <>{children}</>;

  return (
    <div
      className="nf-inbox-swipe"
      data-open={open || undefined}
      data-active={dx !== 0 || dragging || undefined}
      data-testid="inbox-swipe"
    >
      <div className="nf-inbox-swipe__actions" style={{ inlineSize: reveal }} aria-hidden={!open || undefined}>
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            tabIndex={open ? 0 : -1}
            className="nf-inbox-swipe__action"
            data-tone={action.tone ?? "neutral"}
            data-testid={`inbox-swipe-${action.key}`}
            onClick={() => {
              setDx(0);
              action.run();
            }}
          >
            <UiIcon name={action.icon} size={20} />
            <span>{action.label}</span>
          </button>
        ))}
      </div>
      <div
        className="nf-inbox-swipe__row"
        data-dragging={dragging || undefined}
        style={{ transform: dx === 0 ? undefined : `translateX(${dx}px)` }}
        onPointerDown={(event) => {
          if (event.pointerType !== "touch") return;
          moved.current = false;
          start.current = { x: event.clientX, y: event.clientY, base: dx, axis: null, id: event.pointerId };
        }}
        onPointerMove={(event) => {
          const s = start.current;
          if (!s || s.id !== event.pointerId) return;
          const tx = event.clientX - s.x;
          if (s.axis === null) {
            s.axis = lockAxis(tx, event.clientY - s.y);
            if (s.axis === null) return;
          }
          if (s.axis !== "x") return;
          moved.current = true;
          setDragging(true);
          setDx(Math.max(-reveal - 16, Math.min(0, s.base + tx)));
        }}
        onPointerUp={() => {
          const s = start.current;
          start.current = null;
          setDragging(false);
          if (!s || s.axis !== "x") return;
          setDx((now) => (now <= -OPEN_AT ? -reveal : 0));
        }}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
          setDx((now) => (now <= -OPEN_AT ? -reveal : 0));
        }}
        onClickCapture={(event) => {
          /* The tap that ends a swipe, or a tap on an open row, only closes it. */
          if (moved.current || open) {
            moved.current = false;
            event.preventDefault();
            event.stopPropagation();
            setDx(0);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
