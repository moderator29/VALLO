import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { FEED_TABS, FeedTabs, isFeedTab, liveTab } from "./FeedMasthead";

/**
 * For you / Friends: two compact pills in one rounded track, the chosen one
 * marked. Each is a link carrying `?tab=`, so the choice survives a reload.
 */
const t = getDictionary("en");

describe("the feed's tabs", () => {
  it("draws exactly two links, For you and Friends, in a named landmark", () => {
    const html = renderToStaticMarkup(<FeedTabs active="for-you" t={t} />);
    expect(html).toContain('data-testid="feed-tab-for-you"');
    expect(html).toContain('data-testid="feed-tab-friends"');
    expect(html.match(/nf-utabs__tab/g)).toHaveLength(2);
    expect(html).toContain(`aria-label="${t.feedV2.feed.tabsLabel}"`);
    expect(html).toContain(">For you<");
    expect(html).toContain(">Friends<");
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
