import type { ReactNode } from "react";
import Link from "next/link";
import type { Dictionary } from "@vallo/i18n/core";
import "./feed-v2.css";
import { UiIcon } from "@/design-system/icons/UiIcon";
import type { FeedCategory } from "./categories";

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
 * THE CATEGORY CHIPS (founder, 7 November 2026, the feed reference): For
 * you, Friends, Properties, Stays, Restaurants, one row that scrolls sideways
 * on a narrow phone. Each is a link (`?tab=` for Friends, `?cat=` for a
 * category), so the choice survives a reload and is a real history entry;
 * `aria-current` marks the one live chip. Chips are soft rectangles, never
 * capsules, 40px painted inside a 44px target. The live chip is the ink
 * fill; the rest sit on the quiet well with no border.
 */
export function FeedTabs({
  active,
  category = null,
  t,
}: {
  active: FeedTab;
  category?: FeedCategory | null;
  t: Dictionary;
}) {
  const words = t.feedV2.feed;
  const live = category ?? liveTab(active);
  const chips = [
    { key: "for-you", label: words.tabForYou, href: "/around" },
    { key: "friends", label: words.tabFriends, href: "/around?tab=friends" },
    { key: "properties", label: words.catProperties, href: "/around?cat=properties" },
    { key: "stays", label: words.catStays, href: "/around?cat=stays" },
    { key: "restaurants", label: words.catRestaurants, href: "/around?cat=restaurants" },
  ] as const;

  return (
    <nav className="nf-feed-chips" aria-label={words.categoriesLabel} data-testid="feed-tabs">
      <ul className="nf-feed-chips__row">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={chip.href}
              className="nf-tap nf-feed-chip"
              {...(chip.key === live ? { "aria-current": "page" as const } : {})}
              data-testid={`feed-tab-${chip.key}`}
              scroll={false}
            >
              {chip.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * THE FEED'S HEAD (the reference): the large title, one quiet line under it,
 * and at the right the way into Circle and the people search. The bell is the
 * shell header's, directly above, so it is not drawn twice. The place chip
 * rides on the quiet line, because where is a filter on this feed, not its
 * name.
 */
export function FeedHead({ t, place }: { t: Dictionary; place?: ReactNode }) {
  const words = t.feedV2.feed;
  return (
    <header className="nf-feed-head" data-testid="feed-head">
      <div className="nf-feed-head__row">
        <h1 className="nf-feed-head__title">{words.title}</h1>
        <div className="nf-feed-head__actions">
          <Link
            href="/circle"
            className="nf-tap nf-feed-circle-door"
            aria-label={words.circleDoorLabel}
            data-testid="feed-circle-door"
          >
            <UiIcon name="circle-people" size={18} />
            <span>{words.circleDoor}</span>
          </Link>
          <Link href="/around/people" className="nf-feed-find" aria-label={words.findPeople} data-testid="feed-find-people">
            <UiIcon name="search" size={20} />
          </Link>
        </div>
      </div>
      <div className="nf-feed-head__sub">
        <p className="nf-feed-head__line">{words.subtitle}</p>
        {place ? <div className="nf-feed-head__place">{place}</div> : null}
      </div>
    </header>
  );
}
