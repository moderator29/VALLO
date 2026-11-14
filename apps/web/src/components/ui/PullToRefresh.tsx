"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useClientCopy } from "@/lib/i18n/client-copy";
import { PULL_THRESHOLD_PX, pullDistance } from "@/lib/ui/small-rules";

/**
 * PULL TO REFRESH, WITH THE BRAND'S RING (details pass, 30 September 2026).
 *
 * On a phone, at the top of a list, pull down: a small white disc follows the
 * finger with a brand-blue arc that fills as the pull grows. Past the line it
 * tints, the hand feels one light tick, and letting go refreshes the page's
 * server data in place (`router.refresh()`, inside a transition, so what is on
 * screen stays until the new rows land). The mark turns with the drag, spins
 * once on release, holds its arc while it works and rises away when the list
 * is current. Nothing loops.
 *
 *   - Touch only, and only when the page is at the very top, the pull is
 *     mostly downward, and no sheet holds the scroll (the body is not locked).
 *   - A touch that starts inside `[data-no-pull]` is left alone: a map, or
 *     anything else that takes a downward drag for itself, marks its own box.
 *   - The browser's own pull (Chrome's reload) is switched off while this is
 *     mounted (`overscroll-behavior-y: contain` on the root), so one gesture
 *     never means two things.
 *   - Resistance halves the travel, and the disc never comes down further
 *     than 72px, the feel of the platforms' own.
 *   - Transform and opacity only; under reduced motion the disc does not
 *     turn, it simply shows until the refresh is done.
 */
export function PullToRefresh({
  children,
  onRefresh,
  className,
}: {
  children: ReactNode;
  /** Defaults to refreshing the route's server data. */
  onRefresh?: () => Promise<void> | void;
  className?: string;
}) {
  const words = useClientCopy().details.refresh;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const armedRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = "contain";
    return () => {
      root.style.overscrollBehaviorY = before;
    };
  }, []);

  useEffect(() => {
    let startY: number | null = null;
    let startX = 0;
    let tracking = false;
    let distance = 0;

    const locked = () =>
      document.body.style.overflow === "hidden" || document.documentElement.style.overflow === "hidden";

    const onStart = (event: TouchEvent) => {
      if (busy || event.touches.length !== 1 || window.scrollY > 0 || locked()) return;
      const el = rootRef.current;
      if (!el || !el.contains(event.target as Node)) return;
      if (event.target instanceof Element && event.target.closest("[data-no-pull]")) return;
      startY = event.touches[0]!.clientY;
      startX = event.touches[0]!.clientX;
      tracking = false;
      distance = 0;
    };
    const onMove = (event: TouchEvent) => {
      if (startY === null) return;
      const touch = event.touches[0]!;
      const dy = touch.clientY - startY;
      const dx = touch.clientX - startX;
      if (!tracking) {
        /* Decide once, on the first real movement: down and mostly vertical. */
        if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || window.scrollY > 0) {
          startY = null;
          return;
        }
        tracking = true;
      }
      event.preventDefault();
      distance = pullDistance(dy);
      const armed = distance >= PULL_THRESHOLD_PX;
      /* Armed is said by the mark and the words, not the hand: nothing in a
         scroll vibrates (CRAFT_DOCTRINE 6), and this is a scroll. */
      if (armed !== armedRef.current) armedRef.current = armed;
      setPull(distance);
    };
    const onEnd = () => {
      if (startY === null) return;
      startY = null;
      const go = tracking && distance >= PULL_THRESHOLD_PX;
      tracking = false;
      armedRef.current = false;
      if (!go) {
        setPull(0);
        return;
      }
      setBusy(true);
      setPull(PULL_THRESHOLD_PX * 0.75);
      const done = () => {
        setBusy(false);
        setPull(0);
      };
      if (onRefresh) {
        Promise.resolve(onRefresh()).then(done, done);
      } else {
        startTransition(() => router.refresh());
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [busy, onRefresh, router]);

  /* The router's refresh has landed: put the disc away. */
  useEffect(() => {
    if (!onRefresh && busy && !pending) {
      const t = window.setTimeout(() => {
        setBusy(false);
        setPull(0);
      }, 250);
      return () => window.clearTimeout(t);
    }
  }, [busy, pending, onRefresh]);

  const refreshing = busy || pending;
  const progress = Math.min(1, pull / PULL_THRESHOLD_PX);
  const armed = !refreshing && pull >= PULL_THRESHOLD_PX;
  const CIRC = 2 * Math.PI * 9;
  /* Three quarters of a turn over the whole pull: it is turning the whole
     way down. A release only refreshes from a full pull, and the sheet then
     springs back to its resting depth, so while refreshing the angle holds at
     the full pull's 270 degrees and the spin starts where the finger left it,
     not from the shorter resting depth (auditor A8). */
  const turn = Math.round((refreshing ? 1 : progress) * 270);

  return (
    <div
      ref={rootRef}
      className={["nf-ptr", className ?? ""].filter(Boolean).join(" ")}
      data-pulling={pull > 0 && !refreshing ? "" : undefined}
      data-refreshing={refreshing ? "" : undefined}
      data-armed={armed ? "" : undefined}
      aria-busy={refreshing || undefined}
    >
      <div
        className="nf-ptr__mark"
        style={pull > 0 || refreshing ? { transform: `translate3d(0, ${Math.max(pull, 20) - 8}px, 0)` } : undefined}
        role={refreshing ? "status" : undefined}
        aria-label={refreshing ? words.refreshing : armed ? words.release : undefined}
        aria-hidden={refreshing || armed ? undefined : true}
      >
        {/* The mark turns with the drag (a direct response to the finger,
            three quarters of a turn over the pull), and on release spins ONCE
            (`.nf-ptr[data-refreshing]`, details.css) before the held arc: the
            brand mark's own pull, MOTION_SYSTEM "Pull to refresh". */}
        <svg
          className="nf-ptr__ring"
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{ "--nf-ptr-a": `${turn}deg`, transform: `rotate(${turn}deg)` } as CSSProperties}
        >
          <circle className="nf-ptr__track" cx="12" cy="12" r="9" />
          <circle
            cx="12"
            cy="12"
            r="9"
            strokeDasharray={CIRC}
            strokeDashoffset={refreshing ? CIRC * 0.7 : CIRC * (1 - progress)}
            transform="rotate(-90 12 12)"
          />
        </svg>
      </div>
      {children}
    </div>
  );
}
