"use client";

import { useEffect, type RefObject } from "react";

/**
 * THE CURRENT PAGE'S CHIP, IN VIEW ON ARRIVAL (workspace phone pass, 16
 * November 2026). The workspace chip rows (`HostNav`, `AgentInnerNav`) carry
 * more destinations than a phone shows, so on a page late in the row (Settings,
 * Earnings, Promotion) the lit chip was off the right edge and the row read as
 * if no page was current. On mount, and whenever the active page changes, the
 * row's own scroller is moved so the lit chip sits near the middle.
 *
 * It sets `scrollLeft` on the row rather than calling `scrollIntoView`, which
 * would also scroll the page vertically and fight the sticky bar. No motion:
 * the row is placed before anybody looks at it.
 */
export function useActiveChipInView(ref: RefObject<HTMLElement | null>, active: string | null): void {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const chip = root.querySelector<HTMLElement>('[aria-current="page"]');
    const row = chip?.closest<HTMLElement>(".nf-scroll-x");
    if (!chip || !row || row.scrollWidth <= row.clientWidth) return;
    const chipBox = chip.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    const offset = chipBox.left - rowBox.left + row.scrollLeft;
    row.scrollLeft = Math.max(0, offset - (row.clientWidth - chipBox.width) / 2);
  }, [ref, active]);
}
