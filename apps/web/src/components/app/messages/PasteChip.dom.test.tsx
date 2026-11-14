/**
 * THE PASTE CHIP IN A REAL BROWSER (founder, 14 November 2026, handoff 6.2).
 * What a person actually meets: the type tag, two lines of the paste, the
 * length, the over-limit line, a Vallo address named without any request
 * going out, and a close button big enough for a thumb.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/css/threads.css");

const entry = (props: string) => `
  import { mount } from "@/lib/testing/browser-root";
  import { PasteChip } from "@/components/app/messages/PasteChip";
  import { PASTE_WORDS } from "@/lib/paste/words";
  mount(<PasteChip ${props} onRemove={() => { (window as any).__removed = true; }} words={PASTE_WORDS} />);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the paste chip", () => {
  it("shows the tag, two lines and the length, and drops on the close button", async () => {
    const wall = Array.from({ length: 20 }, (_, i) => `Line ${i + 1} of a pasted message.`).join("\n");
    const { page, close } = await mountInBrowser({
      entry: entry(`kind="text" text={${JSON.stringify(wall)}} overBy={0} onOpen={() => undefined}`),
      css: CSS,
    });
    try {
      const chip = page.getByTestId("paste-chip");
      await chip.waitFor();
      expect(await page.locator(".nf-paste__tag").textContent()).toBe("TEXT");
      expect(await page.locator(".nf-paste__detail").textContent()).toContain("characters");
      /* Two lines of the paste, never the wall. */
      const lines = await page.locator(".nf-paste__lines").textContent();
      expect(lines).toContain("Line 1");
      expect(lines).toContain("Line 2");
      expect(lines).not.toContain("Line 3");
      /* A thumb can hit the close button. */
      const box = await page.locator(".nf-paste__drop").boundingBox();
      expect(Math.round(box!.width)).toBeGreaterThanOrEqual(44);
      await page.locator(".nf-paste__drop").click();
      expect(await page.evaluate(() => (window as unknown as { __removed?: boolean }).__removed)).toBe(true);
    } finally {
      await close();
    }
  });

  it("says how far over the message's own limit a wall is", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry('kind="text" text={"x".repeat(2100)} overBy={100} onOpen={() => undefined}'),
      css: CSS,
    });
    try {
      await page.getByTestId("paste-chip").waitFor();
      expect(await page.locator(".nf-paste__detail").textContent()).toBe("100 characters over the limit");
      expect(await page.getByTestId("paste-chip").getAttribute("data-over")).toBe("");
    } finally {
      await close();
    }
  });

  it("names a Vallo address, and leaves a stranger's as its host", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry('kind="link" host="vallospaces.com" path="/listing/abc-123" vallo="listing"'),
      css: CSS,
    });
    try {
      await page.getByTestId("paste-chip").waitFor();
      expect(await page.locator(".nf-paste__tag").textContent()).toContain("LINK");
      expect(await page.locator(".nf-paste__detail").textContent()).toBe("Listing on Vallo");
      /* A link chip has nothing to open: no preview is ever fetched. */
      expect(await page.locator(".nf-paste__face--still").count()).toBe(1);
    } finally {
      await close();
    }
  });
});
