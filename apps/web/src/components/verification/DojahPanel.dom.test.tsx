/**
 * THE SELFIE CHECK PANEL. Start opens the hosted Dojah flow in a frame with
 * the camera delegated; the screen only says what the server's status says.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const entry = (initial: string, note = "null") => `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { DojahPanel } from "@/components/verification/DojahPanel";
  mount(<DojahPanel copy={getDictionary("en").trustVisible.dojah} initial="${initial}" initialNote={${note}} />);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the Dojah selfie check panel", () => {
  it("opens the hosted flow in a frame that may use the camera", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry("none"),
      actions: {
        startDojahCheck: `async () => ({ ok: true, data: { url: "about:blank#dojah" } })`,
        dojahCheckStatus: `async () => ({ ok: true, data: { status: "opened", note: null } })`,
      },
    });
    try {
      await page.getByTestId("dojah-start").click();
      const frame = page.getByTestId("dojah-frame");
      await frame.waitFor();
      expect(await frame.getAttribute("allow")).toBe("camera; geolocation");
      expect(await frame.getAttribute("src")).toBe("about:blank#dojah");
    } finally {
      await close();
    }
  });

  it("says a check is with a person, and offers no second start while it is", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("review"), actions: {} });
    try {
      await page.getByTestId("dojah-status").waitFor();
      expect(await page.getByTestId("dojah-status").innerText()).toContain("A person on our team");
      expect(await page.getByTestId("dojah-start").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("carries the reviewer's own words on a refusal, and lets them try again", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("refused", '"The selfie was too dark."'), actions: {} });
    try {
      await page.getByTestId("dojah-status").waitFor();
      expect(await page.getByTestId("dojah-status").innerText()).toContain("The selfie was too dark.");
      expect(await page.getByTestId("dojah-start").innerText()).toBe("Try the check again");
    } finally {
      await close();
    }
  });
});
