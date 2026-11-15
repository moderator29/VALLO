/**
 * The count tabs' arithmetic (components/ui/CountTabs.tsx), kept apart from
 * the component so the unit suite, which runs in Node, can read it.
 */

/** The badge's text: null at zero or below, the number up to nine, "9+" past it. */
export function formatCount(count: number | undefined | null): string | null {
  if (typeof count !== "number" || !Number.isFinite(count)) return null;
  const whole = Math.floor(count);
  if (whole <= 0) return null;
  return whole > 9 ? "9+" : String(whole);
}

/**
 * How far the row must scroll for the tab to sit wholly inside it, with a
 * little air on the side it came from. Null when it is already in view.
 */
export function scrollTargetFor(
  row: { left: number; right: number; scrollLeft: number },
  tab: { left: number; right: number },
  air = 16,
): number | null {
  if (tab.left < row.left + air) return Math.max(0, row.scrollLeft + (tab.left - row.left) - air);
  if (tab.right > row.right - air) return row.scrollLeft + (tab.right - row.right) + air;
  return null;
}
