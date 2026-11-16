"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * THE CONSOLE'S ONE SIDEWAYS ROW: a tab strip that scrolls on a phone.
 *
 * Two jobs, both small. It places the live tab (`aria-current`) wholly in
 * view on arrival, so an operator on the Flags tab, the sixth of seven, does
 * not land on a strip that hides the tab they are on. And it says which ends
 * still have more to show (`data-more-start`, `data-more-end`), which the
 * stylesheet draws as a soft fade at that edge (`.nf-admin-tabs` in
 * admin.css): the fade is the hint that the row scrolls, and it is gone at
 * the end you have reached.
 *
 * It moves `scrollLeft` on the row itself, never `scrollIntoView`, which
 * would scroll the page as well. The first placement is instant.
 */
export function ScrollRow({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const row = ref.current;
    if (!row || row.scrollWidth <= row.clientWidth) return;
    const live = row.querySelector<HTMLElement>('[aria-current]:not([aria-current="false"])');
    if (!live) return;
    const air = 24;
    const rowBox = row.getBoundingClientRect();
    const box = live.getBoundingClientRect();
    let delta = 0;
    if (box.right > rowBox.right - air) delta = box.right - rowBox.right + air;
    else if (box.left < rowBox.left + air) delta = box.left - rowBox.left - air;
    if (delta !== 0) row.scrollTo({ left: row.scrollLeft + delta, behavior: "auto" });
  }, []);

  useEffect(() => {
    const row = ref.current;
    if (!row) return;
    const mark = () => {
      const max = row.scrollWidth - row.clientWidth;
      row.toggleAttribute("data-more-start", row.scrollLeft > 2);
      row.toggleAttribute("data-more-end", max > 2 && row.scrollLeft < max - 2);
    };
    mark();
    row.addEventListener("scroll", mark, { passive: true });
    const sized = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(mark);
    sized?.observe(row);
    return () => {
      row.removeEventListener("scroll", mark);
      sized?.disconnect();
    };
  }, []);

  return (
    <nav ref={ref as never} aria-label={label} className={className}>
      {children}
    </nav>
  );
}
