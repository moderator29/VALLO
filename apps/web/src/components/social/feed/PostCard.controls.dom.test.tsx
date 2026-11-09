/**
 * EVERY CONTROL ON A POST DOES ITS OWN THING (the dead feed, 7 October).
 *
 * The founder on production: "I can't click a profile, it takes me into the
 * actual content of the post... can't like or comment, none of it is
 * working." The card was opened by an overlay anchor across the whole card,
 * and the feed's arrival motion turned the head and the action row into
 * stacking contexts, so the overlay sat over every control in them.
 *
 * These run in a real Chromium at 390x844 with the feed's real stylesheets
 * (the arrival motion included), and click each control by its centre point
 * the way a finger does. A control that something else is painted over fails
 * here, because Playwright refuses to click an element another one
 * intercepts. Each must do its own thing and must NOT open the post; the body
 * alone opens the post.
 *
 * The post is the preview harness's own fixture (fictional, never shipped).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";
import { PORTED_CSS } from "@/components/ui/ported-test-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");
const CSS = [
  PORTED_CSS,
  read("src", "app", "css", "glass.css"),
  read("src", "app", "social-feed.shared.css"),
  read("src", "app", "social-feed.css"),
  read("src", "app", "css", "feed-m.css"),
  read("src", "components", "social", "feed", "feed-v2.css"),
].join("\n");

const entry = `
  import { PostCard } from "@/components/social/feed/PostCard";
  import { FEED_POSTS } from "@/app/(dev)/preview/f4/fixtures";
  import { mount } from "@/lib/testing/browser-root";
  import { AuthGateProvider } from "@/components/auth/AuthGate";
  const hit = (name) => () => { (window.__hits = window.__hits || []).push(name); };
  const post = FEED_POSTS[0];
  window.__post = { id: post.id, handle: post.author.handle };
  /* Signed in, as the QA member was: the write controls are live, not the
     signed-out gate. */
  mount(
    <AuthGateProvider signedIn>
    <div className="nf-feed-page" style={{ padding: 16 }}>
      <PostCard
        post={post}
        locale="en"
        onLike={hit("like")}
        onReply={hit("reply")}
        onRepost={hit("repost")}
        onShare={hit("share")}
        onSave={hit("save")}
        onMenu={hit("menu")}
      />
    </div>
    </AuthGateProvider>
  );
`;

type Win = {
  __hits?: string[];
  __router?: { calls: unknown[][] };
  __post: { id: string; handle: string };
};

const state = (page: import("playwright-core").Page) =>
  page.evaluate(() => {
    const w = window as unknown as Win;
    return {
      hits: w.__hits ?? [],
      pushes: (w.__router?.calls ?? []).filter((call) => call[0] === "push").map((call) => String(call[1])),
      path: window.location.pathname,
      post: w.__post,
    };
  });

/* A finger's tap at the control's centre, failing fast if anything else is
   painted over it. */
const TAP = { timeout: 4000 } as const;

describe.skipIf(!hasBrowser && !process.env.CI)("a post's controls on a phone", () => {
  for (const [name, selector, expected] of [
    ["like", ".nf-post__act--like", "like"],
    ["comment", ".nf-post__act--reply", "reply"],
    ["repost", ".nf-post__act--repost", "repost"],
    ["save", ".nf-post__act--save", "save"],
    ["share", ".nf-post__act--share", "share"],
    ["the overflow menu", ".nf-post__kebab", "menu"],
  ] as const) {
    it(`${name} does its own thing and does not open the post`, async () => {
      const { page, close } = await mountInBrowser({ entry, css: CSS });
      try {
        await page.locator(selector).first().click(TAP);
        const after = await state(page);
        expect(after.hits).toEqual([expected]);
        expect(after.pushes).toEqual([]);
        expect(after.path).toBe("/");
      } finally {
        await close();
      }
    });
  }

  for (const [name, testId] of [
    ["the avatar", "post-avatar"],
    ["the name", "post-author"],
  ] as const) {
    it(`${name} opens the author's profile, not the post`, async () => {
      const { page, close } = await mountInBrowser({ entry, css: CSS });
      try {
        const { post } = await state(page);
        await Promise.all([page.waitForURL(`**/u/${post.handle}`), page.getByTestId(testId).click(TAP)]);
        const after = await state(page);
        expect(after.path).toBe(`/u/${post.handle}`);
      } finally {
        await close();
      }
    });
  }

  it("a like toggles nothing else: two taps are two likes and no navigation", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await page.locator(".nf-post__act--like").click(TAP);
      await page.locator(".nf-post__act--like").click(TAP);
      const after = await state(page);
      expect(after.hits).toEqual(["like", "like"]);
      expect(after.pushes).toEqual([]);
    } finally {
      await close();
    }
  });

  it("the body, which is not a control, opens the post", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await page.locator(".nf-post__body").click(TAP);
      const after = await state(page);
      expect(after.pushes).toEqual([`/post/${after.post.id}`]);
      expect(after.hits).toEqual([]);
    } finally {
      await close();
    }
  });

  it("the glyphs in the action rows carry no wrapper: each has no fill and no edge", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      const looks = await page.$$eval(".nf-pc__actions .nf-act-pill", (pills) =>
        pills.map((pill) => {
          const style = getComputedStyle(pill);
          /* No fill: no background image and a fully transparent colour. */
          const bare = style.backgroundImage === "none" && /, 0\)$/.test(style.backgroundColor);
          return { bare, border: style.borderTopWidth, height: pill.getBoundingClientRect().height };
        }),
      );
      /* The heart, the comment, the repost, the share and the save: one row
         of bare glyphs since 7 November 2026 (the comment was a filled pill). */
      expect(looks).toHaveLength(5);
      for (const look of looks) {
        expect(look.bare).toBe(true);
        expect(look.border).toBe("0px");
        expect(look.height).toBeGreaterThanOrEqual(44);
      }
    } finally {
      await close();
    }
  });
});
