import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { FEED_TABS, FeedTabs, isFeedTab, liveTab } from "./FeedMasthead";

/**
 * The feed's chips (founder, 7 November 2026): For you, Friends and the three
 * categories, each a link (`?tab=` or `?cat=`), so the choice survives a
 * reload, one marked as the page.
 */
const t = getDictionary("en");

describe("the feed's tabs", () => {
  it("draws five links, For you, Friends and the three categories, in a named landmark", () => {
    const html = renderToStaticMarkup(<FeedTabs active="for-you" t={t} />);
    for (const key of ["for-you", "friends", "properties", "stays", "restaurants"]) {
      expect(html).toContain(`data-testid="feed-tab-${key}"`);
    }
    expect(html.match(/class="nf-tap nf-feed-cat"/g)).toHaveLength(5);
    expect(html).toContain(`aria-label="${t.feedV2.feed.categoriesLabel}"`);
    expect(html).toContain(">For you<");
    expect(html).toContain(">Friends<");
    expect(html).toContain(">Properties<");
  });

  it("a category is the page when chosen, and For you is not", () => {
    const html = renderToStaticMarkup(<FeedTabs active="for-you" category="stays" t={t} />);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/<a(?=[^>]*aria-current="page")(?=[^>]*href="\/around\?cat=stays")[^>]*>/);
  });

  it("links For you to the feed and Friends to ?tab=friends", () => {
    const html = renderToStaticMarkup(<FeedTabs active="for-you" t={t} />);
    expect(html).toMatch(/data-testid="feed-tab-for-you" href="\/around"/);
    expect(html).toMatch(/data-testid="feed-tab-friends" href="\/around\?tab=friends"/);
  });

  it("marks one half as the page and only one", () => {
    for (const [active, live] of [
      ["for-you", "feed-tab-for-you"],
      ["friends", "feed-tab-friends"],
    ] as const) {
      const html = renderToStaticMarkup(<FeedTabs active={active} t={t} />);
      expect(html.match(/aria-current="page"/g)).toHaveLength(1);
      expect(html).toMatch(new RegExp(`aria-current="page"[^>]*data-testid="${live}"`));
    }
  });

  it("answers an old address as the half it opens: Following is Friends, New is For you", () => {
    expect(liveTab("following")).toBe("friends");
    expect(liveTab("new")).toBe("for-you");
    expect(liveTab("for-you")).toBe("for-you");
    expect(liveTab("friends")).toBe("friends");
    const html = renderToStaticMarkup(<FeedTabs active="following" t={t} />);
    expect(html).toMatch(/aria-current="page"[^>]*data-testid="feed-tab-friends"/);
  });

  it("recognises only the addresses it knows", () => {
    for (const tab of FEED_TABS) expect(isFeedTab(tab)).toBe(true);
    for (const bad of ["", "all", "Friends", null, undefined]) expect(isFeedTab(bad)).toBe(false);
  });

  it("says its words from the dictionary in every language, none of them English", () => {
    for (const locale of ["yo", "ig", "ha"] as const) {
      const words = getDictionary(locale).feedV2.feed;
      expect(words.tabForYou).not.toBe(t.feedV2.feed.tabForYou);
      expect(words.tabFriends).not.toBe(t.feedV2.feed.tabFriends);
      const html = renderToStaticMarkup(<FeedTabs active="for-you" t={getDictionary(locale)} />);
      expect(html).toContain(words.tabFriends);
    }
  });
});
