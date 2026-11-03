import type { GlyphName } from "@/design-system/icons/glyphs";
import { familyOf, isCallRow } from "@/app/(app)/notifications/family";

/**
 * THE IN-APP NOTIFICATION BANNER, AS RULES (founder, 1 November 2026: "how
 * X does theirs"). Pure, so the suite holds them.
 */

export type BannerItem = { id: string; kind: string; title: string; body: string | null; href: string | null };

/** How long one banner stays before it leaves on its own, in ms. */
export const BANNER_MS = 5000;

/** At most this many wait their turn; older ones are folded away rather than queued forever. */
export const BANNER_QUEUE_MAX = 3;

/** The glyph a banner draws, by what the notification is about. */
export function bannerGlyph(n: { kind: string; title: string; href: string | null }): GlyphName {
  if (isCallRow(n)) return "ai-human-help";
  switch (familyOf(n)) {
    case "money":
      return "empty-payments";
    case "trust":
      return "shield-check";
    case "spaces":
      return "house";
    case "messages":
      return "chat";
    default:
      return "empty-notifications";
  }
}

/** The path a link opens, without its query or hash. */
function pathOf(href: string): string {
  return href.split(/[?#]/)[0] ?? href;
}

/**
 * Whether a new notification should drop down at all. Not on the
 * notifications screen (the list already shows it arriving), and not when the
 * reader is already looking at the very thing it points at (a message in the
 * open thread).
 */
export function shouldShowBanner(item: BannerItem, pathname: string): boolean {
  if (pathname === "/notifications" || pathname.startsWith("/notifications/")) return false;
  if (item.href && pathOf(item.href) === pathname) return false;
  return true;
}

/** Add one to the queue, newest last, keeping only the latest few. */
export function enqueue(queue: readonly BannerItem[], item: BannerItem): BannerItem[] {
  if (queue.some((q) => q.id === item.id)) return [...queue];
  return [...queue, item].slice(-BANNER_QUEUE_MAX);
}
