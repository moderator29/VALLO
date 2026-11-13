import type { GlyphName } from "@/design-system/icons/glyphs";
import { familyOf, isCallRow } from "@/app/(app)/notifications/family";
import { BANNER_TIMING } from "@/lib/ui/toast";

/**
 * THE IN-APP NOTIFICATION BANNER, AS RULES (founder, 1 November 2026: "how
 * X does theirs"). Pure, so the suite holds them.
 */

export type BannerItem = { id: string; kind: string; title: string; body: string | null; href: string | null };

/**
 * How long one banner stays before it leaves on its own, in ms. On the one
 * timing contract (`BANNER_TIMING` in lib/ui/toast.ts): a notification is
 * something to read and tap, so it takes the long dwell every banner with an
 * action takes, rather than a 5,000ms of its own.
 */
export const BANNER_MS = BANNER_TIMING.dwellLongMs;

/** At most this many wait their turn; older ones are folded away rather than queued forever. */
export const BANNER_QUEUE_MAX = 3;

/** The glyph a banner draws, by what the notification is about. */
export function bannerGlyph(n: { kind: string; title: string; href: string | null }): GlyphName {
  if (isCallRow(n)) return "ai-human-help";
  switch (familyOf(n)) {
    case "money":
      return "empty-payments";
    case "bookings":
      return "house";
    case "messages":
      return "chat";
    case "activity":
      return /verif|badge|passport|sign-?in|device/i.test(n.title) ? "shield-check" : "empty-notifications";
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

/**
 * THE HEADER LINE (FEATURE_BACKLOG A9, the founder's reference "New post from
 * Vibecode"): the kind of thing that arrived, in the lock screen's own words
 * (`lib/push/family.ts`), so the banner, the push and the Activity Centre tab
 * all say the same: Messages, Calls, Bookings, Money, Activity, Offers.
 */
const HEADER: Record<ReturnType<typeof familyOf>, string> = {
  messages: "Messages",
  bookings: "Bookings",
  money: "Money",
  activity: "Activity",
  offers: "Offers",
};

export function bannerHeader(n: { kind: string; title: string; href: string | null }): string {
  return isCallRow(n) ? "Calls" : HEADER[familyOf(n)];
}

/**
 * Whose face the banner can honestly show, read from the link alone: the other
 * person in a conversation, or the profile a follow points at. Anything else
 * draws the family glyph; a face is never guessed.
 */
export type FaceLookup = { by: "thread"; id: string } | { by: "handle"; handle: string } | { by: "user"; id: string } | null;

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The sender a link names outright: `?from=<user uuid>` (or `&from=`), which
 * the database puts on every notification it writes about another member
 * (Vallo Roommates first, 8 November 2026). It wins over the path, because it
 * is the actor, not the page the link opens.
 */
function fromParam(href: string): string | null {
  const query = href.split("#")[0]?.split("?")[1];
  if (!query) return null;
  const from = new URLSearchParams(query).get("from");
  return from && USER_ID.test(from) ? from.toLowerCase() : null;
}

export function faceLookup(href: string | null): FaceLookup {
  if (!href) return null;
  const from = fromParam(href);
  if (from) return { by: "user", id: from };
  const path = pathOf(href);
  const thread = /^\/(?:agent\/|host\/)?messages\/([0-9a-f-]{36})$/i.exec(path);
  if (thread) return { by: "thread", id: thread[1]! };
  const person = /^\/u\/([A-Za-z0-9_.]{1,40})$/.exec(path);
  if (person) return { by: "handle", handle: person[1]! };
  return null;
}
