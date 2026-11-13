"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { usePathname } from "next/navigation";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { useRootFlag } from "@/lib/ui/root-flag";
import {
  BANNER_TIMING,
  bannerExitMs,
  currentToast,
  dismissToast,
  noteRouteChange,
  subscribeToast,
  swipeDismisses,
  type ToastItem,
} from "@/lib/ui/toast";

/**
 * THE ONE PLACE A FEEDBACK BANNER IS DRAWN (Platform Grade 1, P0.4). Mounted
 * once, in the root layout, so every screen, sheet and workspace shares one
 * placement: a wide rounded banner at the TOP, under the status bar and the
 * notch (safe-area aware), centred and capped in width on a desktop. It used
 * to sit above the dock as a small pill (details pass, 30 September); the
 * founder's brief moved it to the top, where the references put it.
 *
 *   - An X on every banner, and swipe it up or sideways to dismiss.
 *
 *   - It follows the finger and springs back if let go early.
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

/** The exit clock lives with the contract (`bannerExitMs` in lib/ui/toast.ts). */
export const exitMs = bannerExitMs;

function useToastItem(): ToastItem | null {
  return useSyncExternalStore(subscribeToast, currentToast, () => null);
}

/* A SINGLETON, even if it is mounted twice. In the app it is mounted once in
   the root layout, but a browser test's harness provides one (browser-root's
   `mount`) while some test entries still add their own, so two can coexist.
   Two live hosts would each draw the current banner, and an assertion that a
   message appears once would see it twice. The first host alive draws; any
   later one draws nothing. `primary` defaults true so the single real host in
   the app never flashes empty waiting for an effect. */
let liveToastHosts = 0;

export function ToastHost() {
  const [primary, setPrimary] = useState(true);
  useEffect(() => {
    liveToastHosts += 1;
    setPrimary(liveToastHosts === 1);
    return () => {
      liveToastHosts -= 1;
    };
  }, []);
  const item = useToastItem();
  /* THE ROUTE RULE (`BANNER_CARRY_MS`): a banner about the page being left
     leaves with it; one raised by the tap that navigated is carried. The path
     only, so a filter in the query string is not a new page. */
  const pathname = usePathname();
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    noteRouteChange();
  }, [pathname]);
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
    }, exitMs());
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `shown` is read, the change that matters is `item`
  }, [item]);

  /* A second host (a test harness one beside the app's) draws nothing. */
  if (!primary) return null;

  return (
    /* No name and no role: an empty landmark on every page is noise, and the
       two live lanes inside do the announcing (axe: aria-prohibited-attr). */
    <div className="nf-toast-host">
      <div aria-live="polite" aria-atomic="true" className="nf-toast-host__lane">
        {shown && !urgent(shown.tone) ? (
          <ToastCard key={shown.id} item={shown} leaving={leaving} />
        ) : null}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="nf-toast-host__lane">
        {shown && urgent(shown.tone) ? (
          <ToastCard key={shown.id} item={shown} leaving={leaving} />
        ) : null}
      </div>
    </div>
  );
}

/** One clean mark per tone (docs/UX_SYSTEM.md, "Feedback"). */
const MARK: Record<ToastItem["tone"], UiIconName> = {
  neutral: "info",
  info: "info",
  success: "check",
  warning: "alert-triangle",
  error: "alert-triangle",
};

/** Error and warning are announced at once; the rest politely. */
function urgent(tone: ToastItem["tone"]): boolean {
  return tone === "error" || tone === "warning";
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
    timer.current = window.setTimeout(() => dismissToast(item.id), Math.max(BANNER_TIMING.minResumeMs, remaining.current));
  };

  /* The same words said again restart the clock in place (same id, a new
     `shownAt`), with no second entrance. */
  const clockFor = useRef(item.shownAt);
  useEffect(() => {
    if (clockFor.current === item.shownAt) return;
    clockFor.current = item.shownAt;
    stop();
    remaining.current = item.durationMs;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the restart is keyed on `shownAt` alone
  }, [item.shownAt]);

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
    /* Up only (Grade 1, the banner is at the top): pulling it down would
       carry it over the page it is reporting on. */
    d.dy = Math.min(0, event.clientY - d.y);
    setOffset({ x: d.dx, y: d.dy });
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    const elapsed = Math.max(1, event.timeStamp - d.t);
    const sideways = Math.abs(d.dx) >= Math.abs(d.dy);
    const along = sideways ? d.dx : d.dy;
    if (swipeDismisses(along, along / elapsed)) {
      /* Carry on in the direction of the throw, then go. */
      setOffset(sideways ? { x: Math.sign(d.dx) * 420, y: 0 } : { x: 0, y: -160 });
      window.setTimeout(() => dismissToast(item.id), 120);
      return;
    }
    setOffset(null);
    start();
  };

  const fade = offset ? Math.max(0, 1 - Math.max(Math.abs(offset.x) / 240, Math.abs(offset.y) / 120)) : undefined;

  return (
    <div
      data-testid={item["data-testid"]}
      data-tone={item.tone}
      data-leaving={leaving || undefined}
      data-dragging={dragging || undefined}
      role={urgent(item.tone) ? "alert" : "status"}
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
      {item.avatarUrl ? (
        <img
          src={item.avatarUrl}
          alt=""
          className="nf-toast__avatar"
          width={28}
          height={28}
        />
      ) : (
        <span className="nf-toast__mark" aria-hidden="true">
          <UiIcon name={MARK[item.tone]} size={20} />
        </span>
      )}
      {/* The sentence and its action stack, so a long failure keeps the
          whole width to read in and "Try again" sits under it. */}
      <div className="nf-toast__body">
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
      <button
        type="button"
        className="nf-toast__close"
        aria-label="Dismiss"
        data-testid="banner-close"
        onClick={() => dismissToast(item.id)}
      >
        <UiIcon name="close" size={16} />
      </button>
    </div>
  );
}
