/**
 * The small things' decisions, pure, so each is tested without a DOM
 * (details pass, 30 September 2026). The components that act on them are
 * `BackToTop`, `PullToRefresh` and the field counter in `Field`.
 */

/**
 * Back to top is offered only when it is useful: the page is long (four
 * screens or more), the reader is well down it (past two screens), and they
 * have just started scrolling UP, the moment somebody looks for the top.
 */
export function shouldOfferTop(input: {
  scrollY: number;
  viewport: number;
  pageHeight: number;
  scrollingUp: boolean;
}): boolean {
  const { scrollY, viewport, pageHeight, scrollingUp } = input;
  if (viewport <= 0) return false;
  return scrollingUp && pageHeight >= viewport * 4 && scrollY > viewport * 2;
}

/**
 * A second tap on the tab that is already open takes its screen back to the
 * top, the way a phone's own tab bar does. Only when the address is exactly
 * the tab's (one level down, the tap goes back to the tab's own screen) and
 * the page has actually been scrolled; at the top the tap is left alone.
 */
export function retapGoesTop(href: string, pathname: string, scrollY: number): boolean {
  return href === pathname && scrollY > 4;
}

/**
 * The "new" pill over a list. `baseline` is the figure the list on screen was
 * drawn against, `figure` the live one (null while unknown). The pill shows
 * only when the live figure has gone past the baseline, and says by how much.
 */
export function newSince(baseline: number | null, figure: number | null): number {
  if (baseline === null || figure === null) return 0;
  return Math.max(0, figure - baseline);
}

/** The baseline follows the figure down (something was read elsewhere), never up. */
export function settleBaseline(baseline: number | null, figure: number | null): number | null {
  if (figure === null) return baseline;
  return baseline === null ? figure : Math.min(baseline, figure);
}

/** The pull that arms a refresh, and the furthest the disc comes down. */
export const PULL_THRESHOLD_PX = 64;
export const PULL_MAX_PX = 96;

/** How far the disc has come for a finger's travel: half, with a ceiling. */
export function pullDistance(fingerPx: number): number {
  if (fingerPx <= 0) return 0;
  return Math.min(PULL_MAX_PX, fingerPx * 0.5);
}

/**
 * The character counter: silent until the reader is near the limit (the
 * last fifth, or the last 10, whichever is more), then "132 / 140" in the
 * muted ink, turning to the error ink at the limit. Numbers only, so it
 * needs no words in any locale.
 */
export function counterFor(length: number, max: number | undefined): { show: boolean; over: boolean } {
  if (!max || max <= 0) return { show: false, over: false };
  const near = Math.max(10, Math.ceil(max * 0.2));
  return { show: length >= max - near, over: length >= max };
}
