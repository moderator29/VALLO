"use client";

import { useEffect, useRef } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { prefersCalm } from "@/lib/ui/calm";

/** The page counts as "at the top" within this distance of it. */
export const NEW_PILL_TOP_PX = 80;

/**
 * THE "NEW" PILL (14 November 2026). A small pill under the app header that
 * says something newer than what is on screen exists, and takes the reader to
 * it: a tap runs `onGo` (a refresh, where the list is not live) and scrolls
 * the page to the top.
 *
 * It is drawn only from a signal the screen already has (a realtime insert,
 * the live unread figure). It never asks the server anything itself and it
 * runs no timer.
 *
 * `onTop` is for a list that is already current (the rows arrived live and
 * the reader only has to see them): reaching the top, by the pill or by
 * scrolling there, tells the owner so it can put the pill away.
 */
export function NewPill({
  count,
  label,
  onGo,
  onTop,
  "data-testid": testId = "new-pill",
}: {
  /** How many new things; zero hides the pill. */
  count: number;
  label: string;
  onGo?: () => void;
  onTop?: () => void;
  "data-testid"?: string;
}) {
  const show = count > 0;
  const top = useRef(onTop);
  useEffect(() => {
    top.current = onTop;
  });

  useEffect(() => {
    if (!show) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (window.scrollY <= NEW_PILL_TOP_PX) top.current?.();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [show]);

  return (
    <button
      type="button"
      className="nf-new-pill"
      data-hidden={show ? undefined : ""}
      aria-hidden={show ? undefined : true}
      tabIndex={show ? 0 : -1}
      data-testid={testId}
      onClick={() => {
        onGo?.();
        window.scrollTo({ top: 0, behavior: prefersCalm() ? "auto" : "smooth" });
        onTop?.();
      }}
    >
      <UiIcon name="arrow-up" size={16} />
      {label}
    </button>
  );
}
