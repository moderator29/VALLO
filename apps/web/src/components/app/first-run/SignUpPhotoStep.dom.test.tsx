/**
 * THE PROFILE PHOTO AS THE LAST STEP OF SIGN-UP, IN A REAL BROWSER (13
 * November 2026, the founder: ask for it before the account is fully up, with
 * a Skip, clean and high end).
 *
 * The real step in Chromium. The avatar pipeline's answer is staged through
 * the step's `upload` seam (the pipeline itself, `uploadAvatarPhoto`, is the
 * profile's own and is unchanged); the router is the harness's recorder. What
 * is proven: a chosen photo is previewed in the circle and saved, and the
 * account goes on to where it was going; Skip goes on at once with nothing
 * uploaded; an upload that fails says so in one line and still lets the
 * person go on, with Skip still there; and a slow one never holds them.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { getDictionary } from "@vallo/i18n";

const copy = getDictionary("en").profileSetup.step;

beforeAll(warmBrowser);
afterAll(closeBrowser);

/* A 1x1 PNG, as the person's pick. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

const entry = (upload: string) => `
  import { getDictionary } from "@vallo/i18n";
  import { SignUpPhotoStep } from "@/components/app/first-run/SignUpPhotoStep";
  import { mount } from "@/lib/testing/browser-root";
  window.__uploads = 0;
  const upload = ${upload};
  mount(<SignUpPhotoStep copy={getDictionary("en").profileSetup.step} userId="u1" next="/listing/abc" upload={(file, user) => { window.__uploads += 1; return upload(file, user); }} />);
`;

const routerCalls = (page: import("playwright-core").Page) =>
  page.evaluate(() => (window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []);

describe.skipIf(!hasBrowser && !process.env.CI)("the profile photo step at the end of sign-up", () => {
  it(
    "a chosen photo is shown in the circle, saved through the avatar pipeline, and the account goes on",
    async () => {
      const { page, close } = await mountInBrowser({ entry: entry(`async () => ({ ok: true, avatarUrl: "https://example.invalid/a.png" })`), reducedMotion: true });
      try {
        await page.getByTestId("signup-photo").waitFor();
        expect(await page.getByTestId("signup-photo-skip").textContent()).toBe(copy.skip);
        await page.getByTestId("signup-photo-library").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
        await page.locator('[data-testid="signup-photo-preview"] img').waitFor();
        await page.getByTestId("signup-photo-continue").click();
        await page.waitForFunction(() => ((window as unknown as { __router?: { calls: unknown[][] } }).__router?.calls ?? []).length > 0);
        expect(await page.evaluate(() => (window as unknown as { __uploads: number }).__uploads)).toBe(1);
        expect(await routerCalls(page)).toEqual([["replace", "/listing/abc"]]);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "Skip goes on at once, with nothing uploaded",
    async () => {
      const { page, close } = await mountInBrowser({ entry: entry(`async () => ({ ok: true, avatarUrl: "x" })`), reducedMotion: true });
      try {
        await page.getByTestId("signup-photo-skip").click();
        expect(await routerCalls(page)).toEqual([["replace", "/listing/abc"]]);
        expect(await page.evaluate(() => (window as unknown as { __uploads: number }).__uploads)).toBe(0);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "an upload that fails says so in one line, keeps Skip, and Continue goes on without the photo",
    async () => {
      const { page, close } = await mountInBrowser({ entry: entry(`async () => ({ ok: false, reason: "upload" })`), reducedMotion: true });
      try {
        await page.getByTestId("signup-photo-library").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
        await page.getByTestId("signup-photo-continue").click();
        await page.getByTestId("signup-photo-failed").waitFor();
        expect(await page.getByTestId("signup-photo-failed").textContent()).toBe(copy.later);
        expect(await page.getByTestId("signup-photo-skip").isVisible()).toBe(true);
        expect(await routerCalls(page)).toEqual([]);
        await page.getByTestId("signup-photo-continue").click();
        expect(await routerCalls(page)).toEqual([["replace", "/listing/abc"]]);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );

  it(
    "a slow upload never holds anyone: Skip still goes on while it is saving",
    async () => {
      const { page, close } = await mountInBrowser({ entry: entry(`() => new Promise(() => {})`), reducedMotion: true });
      try {
        await page.getByTestId("signup-photo-library").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
        await page.getByTestId("signup-photo-continue").click();
        await page.waitForTimeout(300);
        await page.getByTestId("signup-photo-skip").click();
        expect(await routerCalls(page)).toEqual([["replace", "/listing/abc"]]);
      } finally {
        await close();
      }
    },
    BROWSER_TEST_TIMEOUT,
  );
});
