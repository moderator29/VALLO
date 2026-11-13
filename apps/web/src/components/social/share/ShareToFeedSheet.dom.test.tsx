/**
 * "Post to your feed", mounted for real in Chromium on the real Sheet: the
 * member's words come first and the listing is attached under them; posting
 * with words sends them, posting without sends none; the X on the attached
 * listing closes the sheet without posting; and while the feature's SQL is
 * not applied the refusal is said plainly, never drawn as a success.
 * Set `HUNTER_SHOTS_DIR` to also write screenshots.
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
import { SHARE_WORDS } from "@/lib/features/listing-share/model";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = [
  PORTED_CSS,
  readFileSync(join(__dirname, "listing-share.css"), "utf8"),
  readFileSync(join(__dirname, "..", "feed", "feed-v2.css"), "utf8"),
  "#root{padding:16px;}",
].join("\n");

const LISTING = "11111111-1111-4111-8111-111111111111";
const PREVIEW = `async () => ({ ok: true, data: {
  listing: { id: "${LISTING}", title: "Three bedroom terrace in Lekki Phase 1", place: "Lekki Phase 1, Lagos", priceLabel: "N4.5m", periodLabel: "a year", photoUrl: null },
  slots: { used: 0, limit: 2, unlimited: false, left: 2 },
  alreadyShared: false,
  own: false,
} })`;

const entry = `
  import { ShareToFeedSheet } from "@/components/social/share/ShareToFeedSheet";
  import { mount } from "@/lib/testing/browser-root";
  import { subscribeToast } from "@/lib/ui/toast";
  window.__toasts = [];
  window.__closed = 0;
  subscribeToast((item) => { if (item) window.__toasts.push([item.message, item.tone]); });
  mount(<ShareToFeedSheet open onClose={() => { window.__closed += 1; }} listingId="${LISTING}" />);
`;

type Page = import("playwright-core").Page;
/** The first argument of every call to one server action (the harness records `[name, ...args]`). */
const calls = (page: Page, name: string) =>
  page.evaluate((n) => ((window as unknown as { __calls?: unknown[][] }).__calls ?? []).filter((c) => c[0] === n).map((c) => c[1]), name);
const toasts = (page: Page) => page.evaluate(() => (window as unknown as { __toasts: [string, string][] }).__toasts);
const closed = (page: Page) => page.evaluate(() => (window as unknown as { __closed: number }).__closed);

const SHARED = `async () => ({ ok: true, data: { postId: "22222222-2222-4222-8222-222222222222", slots: { used: 1, limit: 2, unlimited: false, left: 1 } } })`;

describe.skipIf(!hasBrowser)("Post to your feed", () => {
  it("puts the member's words above the attached listing, and posts them", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS, actions: { readListingSharePreview: PREVIEW, shareListingToFeed: SHARED } });
    try {
      await page.waitForSelector('[data-testid="share-preview"]');
      const order = await page.evaluate(() => {
        const note = document.querySelector('[data-testid="share-note"]')!.getBoundingClientRect();
        const card = document.querySelector('[data-testid="share-preview"]')!.getBoundingClientRect();
        return note.bottom <= card.top;
      });
      expect(order).toBe(true);
      expect(await page.textContent('[data-testid="share-preview"]')).toContain("Three bedroom terrace in Lekki Phase 1");
      expect(await page.textContent('[data-testid="share-to-feed-submit"]')).toContain(SHARE_WORDS.share);
      if (process.env.HUNTER_SHOTS_DIR) await page.screenshot({ path: join(process.env.HUNTER_SHOTS_DIR, "post-to-feed-sheet-390.png") });

      await page.fill('[data-testid="share-note"]', "Close to the lagoon, and the fees are all stated.");
      await page.click('[data-testid="share-to-feed-submit"]');
      await page.waitForFunction(() => (window as unknown as { __closed: number }).__closed > 0);
      const sent = (await calls(page, "shareListingToFeed")) as { listingId: string; note?: string }[];
      expect(sent).toHaveLength(1);
      expect(sent[0]?.listingId).toBe(LISTING);
      expect(sent[0]?.note).toBe("Close to the lagoon, and the fees are all stated.");
    } finally {
      await close();
    }
  });

  it("posts with no words when none are written", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS, actions: { readListingSharePreview: PREVIEW, shareListingToFeed: SHARED } });
    try {
      await page.waitForSelector('[data-testid="share-preview"]');
      await page.click('[data-testid="share-to-feed-submit"]');
      await page.waitForFunction(() => (window as unknown as { __closed: number }).__closed > 0);
      const sent = (await calls(page, "shareListingToFeed")) as { note?: string }[];
      expect(sent).toHaveLength(1);
      expect(sent[0]?.note).toBeUndefined();
    } finally {
      await close();
    }
  });

  it("the X on the attached listing closes the sheet and posts nothing", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS, actions: { readListingSharePreview: PREVIEW, shareListingToFeed: SHARED } });
    try {
      await page.waitForSelector('[data-testid="share-remove-attachment"]');
      const size = await page.$eval('[data-testid="share-remove-attachment"]', (el) => {
        const r = el.getBoundingClientRect();
        return [Math.round(r.width), Math.round(r.height)];
      });
      expect(size[0]).toBeGreaterThanOrEqual(44);
      expect(size[1]).toBeGreaterThanOrEqual(44);
      await page.click('[data-testid="share-remove-attachment"]');
      expect(await closed(page)).toBe(1);
      expect(await calls(page, "shareListingToFeed")).toHaveLength(0);
    } finally {
      await close();
    }
  });

  it("while posting is not open, says so in the banner and keeps the sheet", async () => {
    const { page, close } = await mountInBrowser({
      entry,
      css: CSS,
      actions: { readListingSharePreview: PREVIEW, shareListingToFeed: `async () => ({ ok: false, error: ${JSON.stringify(SHARE_WORDS.notOpen)} })` },
    });
    try {
      await page.waitForSelector('[data-testid="share-preview"]');
      await page.click('[data-testid="share-to-feed-submit"]');
      await page.waitForFunction(() => (window as unknown as { __toasts: unknown[] }).__toasts.length > 0);
      expect(await toasts(page)).toEqual([[SHARE_WORDS.notOpen, "error"]]);
      expect(await closed(page)).toBe(0);
    } finally {
      await close();
    }
  });
});
