"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { motionQuiet } from "@/lib/motion/gate";

/**
 * A SIDEWAYS ROW THAT KEEPS ITS LIVE ITEM IN VIEW.
 *
 * A chip row that scrolls sideways on a narrow phone (the feed's categories,
 * a tab strip) opens at its start, so a person who chose Restaurants, the
 * last chip, comes back to a row that hides the one thing it says. This
 * wrapper moves the row, and only the row, so the item marked
 * `aria-current` (or `aria-selected="true"`) sits fully on screen with a
 * gutter of breathing room.
 *
 * It sets `scrollLeft` on the row itself rather than calling
 * `scrollIntoView`, because `scrollIntoView` also scrolls every ancestor and
 * would jump the page to the row. The first placement is instant (nothing
 * slides on arrival); later changes glide unless reduced motion is asked for.
 * `watch` is whatever names the live item, so a change of it re-runs.
 */
export function ActiveInView({
  children,
  watch,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  watch: string | null | undefined;
  className?: string;
  as?: "div" | "ul";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const placed = useRef(false);

  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    const live = row.querySelector<HTMLElement>('[aria-current]:not([aria-current="false"]), [aria-selected="true"]');
    if (!live || row.scrollWidth <= row.clientWidth) {
      placed.current = true;
      return;
    }
    const gutter = 16;
    const rowBox = row.getBoundingClientRect();
    const box = live.getBoundingClientRect();
    let delta = 0;
    if (box.right > rowBox.right - gutter) delta = box.right - rowBox.right + gutter;
    else if (box.left < rowBox.left + gutter) delta = box.left - rowBox.left - gutter;
    if (delta !== 0) {
      const quiet = !placed.current || motionQuiet();
      row.scrollTo({ left: row.scrollLeft + delta, behavior: quiet ? "auto" : "smooth" });
    }
    placed.current = true;
  }, [watch]);

  return (
    <Tag ref={ref as never} className={className}>
      {children}
    </Tag>
  );
}
