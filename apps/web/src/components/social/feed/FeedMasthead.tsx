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

/**
 * THE TWO LENSES (VALLO_CIRCLE.md, "What Agent FE does now").
 *
 * Around is everyone near you, and it is the feed this page draws. Circle is
 * the people you trust, and it is not open: the founder has the brief to
 * approve first. So the switch is drawn with Around chosen and Circle shown
 * beside it, quiet, with a plain word that says it is not open. Nothing about
 * Circle can be tapped, so nothing on this screen promises a door that leads
 * nowhere. The tag says what is true today rather than a date, because the
 * product never promises a schedule it cannot keep (`lib/copy/banned-phrases`).
 *
 * The words are type, not a second tab row: the For you and Friends tabs under
 * the stories choose WHICH Around, and this chooses which lens, so the two
 * never read as the same control.
 */
export function FeedLenses({ t }: { t: Dictionary }) {
  const words = t.feedV2.feed;
  return (
    <div className="nf-lens" role="group" aria-label={words.lensLabel} data-testid="feed-lenses">
      <span className="nf-lens__item" aria-current="page" data-testid="feed-lens-around">
        {words.lensAround}
      </span>
      <span className="nf-lens__item nf-lens__item--closed" aria-disabled="true" data-testid="feed-lens-circle">
        <span className="nf-lens__word">{words.lensCircle}</span>
        <span className="nf-lens__tag">{words.lensCircleClosed}</span>
      </span>
    </div>
  );
}
