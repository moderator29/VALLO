/**
 * VIDEOS ARE SLIDES OF THE ONE GALLERY (founder, 13 October). Three photos and
 * two videos, mounted for real in Chromium: they swipe through in the
 * lister's order, only the video slides carry the "Watch video" button, and
 * pressing it plays that video in place, muted, with its controls, fetching
 * the file only then. Swiping away stops it.
 *
 * THE COVER SAYS SO TOO (founder's reference, 13 October 2026): while the
 * slide on screen is a photo, one "Watch video" pill floats over it and jumps
 * straight to the first video, playing it. So at any moment exactly ONE
 * "Watch video" is on the screen: the cover's on a photo slide, the slide's own
 * on a video slide, and none while a video plays.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { appCss } from "@/lib/testing/locale-fit";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT * 2 });
beforeAll(async () => {
  if (hasBrowser) await warmBrowser();
});
afterAll(closeBrowser);

const entry = `
  import { mount } from "@/lib/testing/browser-root";
  import { ListingGallery } from "@/components/app/listing/ListingGallery";
  import { PhotoViewerProvider } from "@/components/app/listing/PhotoViewer";
  import { listingMedia } from "@/components/app/listing/gallery-media";

  const PHOTOS = ["/p/one.jpg", "/p/two.jpg", "/p/three.jpg"];
  const VIDEOS = [
    { url: "/v/a.mp4", posterUrl: "/v/a.jpg", durationSeconds: 42, position: 1 },
    { url: "/v/b.mp4", posterUrl: "/v/b.jpg", durationSeconds: 18, position: 4 },
  ];
  const media = listingMedia(PHOTOS, VIDEOS);
  mount(
    <PhotoViewerProvider title="Two bedroom flat, Yaba" photos={PHOTOS} media={media} hue={210} kind="apartment">
      <ListingGallery listingId="l1" title="Two bedroom flat, Yaba" hue={210} kind="apartment" photos={PHOTOS} media={media} floatingBack={false} />
    </PhotoViewerProvider>
  );
`;

describe.skipIf(!hasBrowser && !process.env.CI)("ListingGallery with videos", () => {
  it("swipes through photos and videos in order; only videos show the pill; pressing it plays in place", async () => {
    const { page, close } = await mountInBrowser({ entry, css: await appCss() });
    try {
      const track = page.locator('[role="group"][aria-label^="Photographs of"]');
      await track.waitFor();
      const panes = track.locator(":scope > div");
      expect(await panes.count()).toBe(5);
      const kinds = await panes.evaluateAll((els) => els.map((el) => el.getAttribute("data-kind") ?? "photo"));
      expect(kinds).toEqual(["photo", "video", "photo", "photo", "video"]);

      /* The slide pill is a real button named "Watch video", on the video
         slides only; the cover carries the one extra, outside the panes. */
      expect(await track.getByRole("button", { name: "Watch video" }).count()).toBe(2);
      expect(await page.getByTestId("gallery-watch-cover").count()).toBe(1);
      expect(await page.getByRole("button", { name: "Watch video" }).count()).toBe(3);
      for (const i of [0, 2, 3]) expect(await panes.nth(i).getByTestId("gallery-watch").count()).toBe(0);
      expect(await panes.nth(1).getByTestId("gallery-watch").count()).toBe(1);
      expect(await panes.nth(4).getByTestId("gallery-watch").count()).toBe(1);

      /* Photos keep their name: each photo slide is still the button that
         opens it full screen (the image itself is drawn behind it). */
      for (const i of [0, 2, 3]) {
        expect(await panes.nth(i).getByRole("button", { name: `View photo ${i + 1} full screen` }).count()).toBe(1);
      }
      expect(await panes.nth(1).getByTestId("gallery-open").count()).toBe(0);

      /* Nothing plays, and nothing is fetched, while a photo is on screen. */
      expect(await page.locator("video").count()).toBe(0);

      /* THE TILE PLAYS ON ITS OWN, MUTED (13 November 2026): swiping to the
         first video puts its player there without a press, muted, with its
         controls, and fetching only what a first frame needs. */
      await track.evaluate((el) => el.scrollTo({ left: el.clientWidth, behavior: "instant" as ScrollBehavior }));
      await page.waitForTimeout(400);
      expect((await page.getByTestId("gallery-counter").count())).toBe(0);
      const player = page.getByTestId("gallery-video");
      await player.waitFor();
      const state = await player.evaluate((v: HTMLVideoElement) => ({
        src: v.getAttribute("src"),
        muted: v.muted,
        controls: v.controls,
        inline: v.hasAttribute("playsinline"),
      }));
      expect(state).toEqual({ src: "/v/a.mp4", muted: true, controls: true, inline: true });
      expect(await panes.nth(1).getByTestId("gallery-watch").count()).toBe(0);

      /* No cover pill while the slide on screen is a video. */
      expect(await page.getByTestId("gallery-watch-cover").count()).toBe(0);

      /* Swiping away stops it: the player is gone and the pill is back. */
      await track.evaluate((el) => el.scrollTo({ left: el.clientWidth * 2, behavior: "instant" as ScrollBehavior }));
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="gallery-video"]').length === 0, null, { timeout: 5000 });
      expect(await panes.nth(1).getByTestId("gallery-watch").count()).toBe(1);

      /* Back on a photo, the cover pill is back, and it jumps to the FIRST
         video and plays it in place. */
      await page.getByTestId("gallery-watch-cover").click();
      await page.getByTestId("gallery-video").waitFor();
      expect(await page.getByTestId("gallery-video").getAttribute("src")).toBe("/v/a.mp4");
      expect((await page.getByTestId("gallery-counter").count())).toBe(0);
      expect(await track.evaluate((el) => Math.round(el.scrollLeft / el.clientWidth))).toBe(1);
      expect(await page.getByTestId("gallery-watch-cover").count()).toBe(0);
    } finally {
      await close();
    }
  });

  /* DATA SAVING: nothing plays on its own; the pill starts it, as before. */
  it("on data saving, swiping to a video plays nothing until its pill is pressed", async () => {
    const { page, close } = await mountInBrowser({ entry, css: await appCss(), init: 'document.addEventListener("DOMContentLoaded", function () { document.documentElement.dataset.saveData = "on"; }); document.documentElement && (document.documentElement.dataset.saveData = "on");' });
    try {
      const track = page.locator('[role="group"][aria-label^="Photographs of"]');
      await track.waitFor();
      const panes = track.locator(":scope > div");
      await track.evaluate((el) => el.scrollTo({ left: el.clientWidth, behavior: "instant" as ScrollBehavior }));
      await page.waitForTimeout(400);
      expect(await page.locator("video").count()).toBe(0);
      await panes.nth(1).getByTestId("gallery-watch").click();
      await page.getByTestId("gallery-video").waitFor();
    } finally {
      await close();
    }
  });
});
