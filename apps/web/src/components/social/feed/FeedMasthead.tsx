import type { Dictionary } from "@vallo/i18n/core";
import "./feed-v2.css";
import { UnderlineTabs } from "@/components/ui/UnderlineTabs";

/**
 * The feed's modes. `for-you` and `friends` are the two the control draws.
 *
 *   for-you   the places you joined and everything said to the platform at
 *             large; for somebody who has joined nothing, everywhere.
 *   friends   what the people you follow have written, newest first.
 *
 * `following` and `new` survive as valid addresses for old links. `following`
 * lit the second half before it meant people (it read the places you joined),
 * and the second half is what it opens now; `new` is everything anybody may
 * read and lights For you, which is what For you falls back to.
 */
export const FEED_TABS = ["for-you", "friends", "following", "new"] as const;
export type FeedTab = (typeof FEED_TABS)[number];

export function isFeedTab(value: string | undefined | null): value is FeedTab {
  return !!value && (FEED_TABS as readonly string[]).includes(value);
}

/** The control's two halves: an old address is read as the half it opens. */
export function liveTab(active: FeedTab): "for-you" | "friends" {
  return active === "friends" || active === "following" ? "friends" : "for-you";
}

/**
 * For you / Friends, as the underline tab row (founder, 1 November 2026: the
 * sports app's tabs). Each is a link carrying `?tab=`, so the choice survives
 * a reload and puts a real entry in the history; `aria-current` marks the
 * live one. Every tab is 44px tall.
 */
export function FeedTabs({ active, t }: { active: FeedTab; t: Dictionary }) {
  const words = t.feedV2.feed;
  const live = liveTab(active);
  const segments = [
    { tab: "for-you", label: words.tabForYou, href: "/around" },
    { tab: "friends", label: words.tabFriends, href: "/around?tab=friends" },
  ] as const;

  return (
    <UnderlineTabs
      label={words.tabsLabel}
      active={live}
      items={segments.map((segment) => ({ key: segment.tab, label: segment.label, href: segment.href }))}
      data-testid="feed-tabs"
      itemTestIdPrefix="feed-tab-"
      className="nf-feed-utabs"
    />
  );
}
