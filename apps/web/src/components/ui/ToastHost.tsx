"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { useRootFlag } from "@/lib/ui/root-flag";
import {
  currentToast,
  dismissToast,
  subscribeToast,
  swipeDismisses,
  type ToastItem,
} from "@/lib/ui/toast";

/**
 * THE ONE PLACE A TOAST IS DRAWN (details pass). Mounted once, in the root
 * layout, so every screen, sheet and workspace shares one placement: above
 * the dock on a phone (the dock's own clearance token, so it never covers the
 * tabs), bottom centre on a desktop.
 *
 *   - Swipe it sideways or down to dismiss; it follows the finger and springs
 *     back if let go early.
 *   - Holding it (or hovering on a desktop) stops the clock, so a sentence is
 *     never taken away mid-read.
 *   - Escape dismisses it from a keyboard.
 *   - A success carries a check, an error a warning glyph and a longer dwell;
 *     an error is announced at once, everything else politely. The two live
 *     regions are always in the page, so the announcement is reliable.
 *
 * Motion is transform and opacity only (Session 3, north star motion 8): a
 * dark pill rising 16px on `land` 240ms, out on `leave` 160ms; the material
 * and curves are `.nf-toast-host .nf-toast` in overlays.css, and every
 * duration collapses under reduced motion and the Motion setting.
 */
/** `leave` 160ms: how long a leaving toast stays mounted (`--nf-duration-fast`). */
export const TOAST_EXIT_MS = 160;
const EXIT_MS = TOAST_EXIT_MS;

function useToastItem(): ToastItem | null {
  return useSyncExternalStore(subscribeToast, currentToast, () => null);
}

export function ToastHost() {
  const item = useToastItem();
  /* The item on screen, kept through its exit so it can leave rather than vanish. */
  const [shown, setShown] = useState<ToastItem | null>(null);
  const [leaving, setLeaving] = useState(false);

  /* Deriving the leaving copy needs the previous item, which only an effect
     sees; the writes are the exit's two frames, not a render loop. */
  useEffect(() => {
    if (item) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the exit keeps the last item on screen
      setShown(item);
      setLeaving(false);
      return;
    }
    if (!shown) return;
    setLeaving(true);
    const t = window.setTimeout(() => {
      setShown(null);
      setLeaving(false);
    }, EXIT_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `shown` is read, the change that matters is `item`
  }, [item]);

  return (
    /* No name and no role: an empty landmark on every page is noise, and the
       two live lanes inside do the announcing (axe: aria-prohibited-attr). */
    <div className="nf-toast-host">
      <div aria-live="polite" aria-atomic="true" className="nf-toast-host__lane">
        {shown && shown.tone !== "error" ? (
          <ToastCard key={shown.id} item={shown} leaving={leaving} />
        ) : null}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="nf-toast-host__lane">
        {shown && shown.tone === "error" ? (
          <ToastCard key={shown.id} item={shown} leaving={leaving} />
        ) : null}
      </div>
    </div>
  );
}

function ToastCard({ item, leaving }: { item: ToastItem; leaving: boolean }) {
  const drag = useRef<{ x: number; y: number; t: number; dx: number; dy: number; id: number } | null>(null);
  const remaining = useRef(item.durationMs);
  const startedAt = useRef(0);
  const timer = useRef<number | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  /* `data-toast-up` on <html> while a toast is on screen: back to top steps
     aside for it (details.css, lib/ui/root-flag.ts). */
  useRootFlag("toast-up");

  const stop = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
      remaining.current -= Date.now() - startedAt.current;
    }
  };
  const start = () => {
    if (timer.current !== null) return;
    startedAt.current = Date.now();
    timer.current = window.setTimeout(() => dismissToast(item.id), Math.max(1200, remaining.current));
  };

  useEffect(() => {
    start();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissToast(item.id);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      stop();
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one clock per toast
  }, [item.id]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    stop();
    drag.current = { x: event.clientX, y: event.clientY, t: event.timeStamp, dx: 0, dy: 0, id: event.pointerId };
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    d.dx = event.clientX - d.x;
    /* Down only: pushing it up would carry it over the page it is reporting on. */
    d.dy = Math.max(0, event.clientY - d.y);
    setOffset({ x: d.dx, y: d.dy });
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    const elapsed = Math.max(1, event.timeStamp - d.t);
    const along = Math.abs(d.dx) >= d.dy ? d.dx : d.dy;
    if (swipeDismisses(along, along / elapsed)) {
      /* Carry on in the direction of the throw, then go. */
      setOffset(Math.abs(d.dx) >= d.dy ? { x: Math.sign(d.dx) * 420, y: 0 } : { x: 0, y: 160 });
      window.setTimeout(() => dismissToast(item.id), 120);
      return;
    }
    setOffset(null);
    start();
  };

  const fade = offset ? Math.max(0, 1 - Math.max(Math.abs(offset.x) / 240, offset.y / 120)) : undefined;

  return (
    <div
      data-testid={item["data-testid"]}
      data-tone={item.tone}
      data-leaving={leaving || undefined}
      data-dragging={dragging || undefined}
      role={item.tone === "error" ? "alert" : "status"}
      className="nf-toast"
      style={
        offset
          ? { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`, opacity: fade }
          : undefined
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onMouseEnter={stop}
      onMouseLeave={() => {
        if (!drag.current) start();
      }}
    >
      {item.tone === "success" ? (
        <span className="nf-toast__mark" aria-hidden="true">
          <UiIcon name="check" size={16} />
        </span>
      ) : item.tone === "error" ? (
        <span className="nf-toast__mark" aria-hidden="true">
          <UiIcon name="alert-triangle" size={16} />
        </span>
      ) : null}
      <p className="nf-toast__text">{item.message}</p>
      {item.action ? (
        <button
          type="button"
          className="nf-toast__action"
          onClick={() => {
            item.action?.run();
            dismissToast(item.id);
          }}
        >
          {item.action.label}
        </button>
      ) : null}
    </div>
  );
}
