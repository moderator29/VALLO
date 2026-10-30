/**
 * THE POST CARD, AS THE FOUNDER'S 13 OCTOBER REFERENCE DRAWS IT.
 *
 *   - words with a picture: the caption sits ABOVE the picture's frame;
 *   - words with no picture: the words sit INSIDE the same rounded frame, a
 *     short line set large, a long one folded with "Read more";
 *   - the "Drop a comment" pill opens the existing reply flow, and nothing
 *     else: it does not open the post and it is not the heart;
 *   - the role word and the moderator mark are drawn only where they are real.
 *
 * Real Chromium at 390x844 with the feed's real stylesheets. The posts are
 * fixtures (fictional, never shipped).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { PORTED_CSS } from "@/components/ui/ported-test-css";
import { shapeOfText } from "./PostCard";

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

const LONG = Array.from({ length: 12 }, (_, i) => `Line ${i + 1} of a longer post that has plenty to say about the neighbourhood.`).join("\n");

/** A fixture post, edited by `over`, mounted signed in. */
const entryFor = (over: string) => `
  import { PostCard } from "@/components/social/feed/PostCard";
  import { FEED_POSTS } from "@/app/(dev)/preview/f4/fixtures";
  import { mount } from "@/lib/testing/browser-root";
  import { AuthGateProvider } from "@/components/auth/AuthGate";
  const hit = (name) => () => { (window.__hits = window.__hits || []).push(name); };
  const post = { ...FEED_POSTS[0], ...(${over}) };
  window.__post = { id: post.id };
  mount(
    <AuthGateProvider signedIn>
      <div className="nf-fv2-page" style={{ padding: 16 }}>
        <PostCard post={post} locale="en" onLike={hit("like")} onReply={hit("reply")} onRepost={hit("repost")}
          onShare={hit("share")} onSave={hit("save")} onMenu={hit("menu")} />
      </div>
    </AuthGateProvider>
  );
`;

const state = (page: import("playwright-core").Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __hits?: string[]; __router?: { calls: unknown[][] }; __post: { id: string } };
    return {
      hits: w.__hits ?? [],
      pushes: (w.__router?.calls ?? []).filter((c) => c[0] === "push").map((c) => String(c[1])),
      id: w.__post.id,
    };
  });

describe("the words of a post (pure)", () => {
  it("sets a short text post at reading size, never blown up (X, 29 October 2026)", () => {
    expect(shapeOfText("Hey", "frame", false)).toEqual({ big: false, long: false });
    expect(shapeOfText("Any good flats in Yaba?", "frame", false)).toEqual({ big: false, long: false });
  });
  it("folds a long post with Read more, but never on the post's own page", () => {
    expect(shapeOfText(LONG, "frame", false).long).toBe(true);
    expect(shapeOfText(LONG, "frame", true).long).toBe(false);
    expect(shapeOfText("x".repeat(400), "frame", false).long).toBe(true);
  });
  it("sets a caption at body size and folds it sooner", () => {
    expect(shapeOfText("Short caption", "caption", false)).toEqual({ big: false, long: false });
    expect(shapeOfText("y".repeat(240), "caption", false).long).toBe(true);
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("a post card on a phone", () => {
  it("puts the caption above the picture", async () => {
    const { page, close } = await mountInBrowser({
      entry: entryFor(`{ body: "A caption above the picture", media: [{ url: "/brand/photos/villa-exterior-sunset-640.jpg", width: 640, height: 427 }] }`),
      css: CSS,
    });
    try {
      const order = await page.evaluate(() => {
        const caption = document.querySelector(".nf-pc__caption")!;
        const frame = document.querySelector(".nf-pc__media")!;
        return { follows: Boolean(caption.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING), text: caption.textContent };
      });
      expect(order.follows).toBe(true);
      expect(order.text).toContain("A caption above the picture");
      expect(await page.locator(".nf-pc__textframe").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("draws a text-only post as plain words, with no frame around them", async () => {
    const { page, close } = await mountInBrowser({
      entry: entryFor(`{ body: "Hey", media: [] }`),
      css: CSS,
    });
    try {
      const text = page.locator(".nf-pc__plaintext .nf-pc__text");
      expect(await text.innerText()).toContain("Hey");
      expect(await page.locator(".nf-pc__textframe").count()).toBe(0);
      expect(await page.locator(".nf-pc__media").count()).toBe(0);
      /* As tall as the words: one line, not a 9rem box. */
      const height = await page.locator(".nf-pc__plaintext").evaluate((el) => el.getBoundingClientRect().height);
      expect(height).toBeLessThan(48);
    } finally {
      await close();
    }
  });

  it("folds a long text post and unfolds it on Read more without opening the post", async () => {
    const { page, close } = await mountInBrowser({ entry: entryFor(`{ body: ${JSON.stringify(LONG)}, media: [] }`), css: CSS });
    try {
      const more = page.getByRole("button", { name: "Read more" });
      expect(await more.count()).toBe(1);
      expect(await page.locator(".nf-pc__text--clamped").count()).toBe(1);
      await more.click({ timeout: 4000 });
      expect(await page.locator(".nf-pc__text--clamped").count()).toBe(0);
      expect(await page.getByRole("button", { name: "Show less" }).count()).toBe(1);
      expect((await state(page)).pushes).toEqual([]);
    } finally {
      await close();
    }
  });

  it("the comment pill opens the reply flow: it asks to reply and does not open the post", async () => {
    const { page, close } = await mountInBrowser({ entry: entryFor(`{ media: [] }`), css: CSS });
    try {
      const pill = page.getByTestId("post-comment-pill");
      expect(await pill.innerText()).toContain("Drop a comment");
      expect((await pill.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await pill.click({ timeout: 4000 });
      const after = await state(page);
      expect(after.hits).toEqual(["reply"]);
      expect(after.pushes).toEqual([]);
    } finally {
      await close();
    }
  });

  it("draws the role word and the moderator mark only where they are real", async () => {
    const author = `{ ...FEED_POSTS[0].author, isAgent: true, supplyRole: "owner", moderatorOf: "Ikoyi" }`;
    const real = await mountInBrowser({ entry: entryFor(`{ author: ${author} }`), css: CSS });
    try {
      const marks = await real.page.locator(".nf-pc__mark").allInnerTexts();
      expect(marks).toEqual(["Landlord", "Mod"]);
    } finally {
      await real.close();
    }
    const plain = await mountInBrowser({
      entry: entryFor(`{ author: { ...FEED_POSTS[0].author, isAgent: false, supplyRole: null, moderatorOf: null } }`),
      css: CSS,
    });
    try {
      expect(await plain.page.locator(".nf-pc__mark").count()).toBe(0);
    } finally {
      await plain.close();
    }
  });

  it("an agent who is not a landlord reads Agent", async () => {
    const { page, close } = await mountInBrowser({
      entry: entryFor(`{ author: { ...FEED_POSTS[0].author, isAgent: true, supplyRole: "agent", moderatorOf: null } }`),
      css: CSS,
    });
    try {
      expect(await page.locator(".nf-pc__mark").allInnerTexts()).toEqual(["Agent"]);
    } finally {
      await close();
    }
  });
});
