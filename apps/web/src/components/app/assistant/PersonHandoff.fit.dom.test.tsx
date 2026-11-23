/**
 * TALK TO A PERSON FITS A PHONE (23 November 2026).
 *
 * The founder's screenshot: on a 390px phone the open support conversations,
 * the question box and Send ran past the right edge of the screen. A ticket
 * topic such as "Someone asked me to pay outside Vallo" is one line that is
 * truncated, and the grid around it was sized to the whole line, so every
 * row of the page grew as wide as that line. This mounts the real screen in
 * the app's own stylesheet at phone width, inside a 16px page gutter, and
 * checks nothing reaches past the gutter.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";
import { layoutCss } from "@/lib/testing/locale-fit";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const entry = `
  import { mount } from "@/lib/testing/browser-root";
  import { PersonHandoff } from "@/components/app/assistant/PersonHandoff";
  mount(
    <div style={{ paddingInline: "16px" }} id="gutter">
      <PersonHandoff
        signedIn
        openTickets={[
          { id: "t1", reference: "VAL-SUP-87494", topic: "Verification", unread: false },
          { id: "t2", reference: "NF-SUP-27932", topic: "Someone asked me to pay outside Vallo and kept insisting on a transfer", unread: true },
        ]}
      />
    </div>,
  );
`;

describe.skipIf(!hasBrowser && !process.env.CI)("talk to a person on a phone", () => {
  it("keeps every row inside the screen's gutter", async () => {
    const css = await layoutCss("app/(app)/layout.tsx");
    const { page, close } = await mountInBrowser({ entry, css, viewport: { width: 390, height: 844 } });
    try {
      await page.getByTestId("person-send").waitFor();
      const fit = await page.evaluate(() => {
        const limit = window.innerWidth - 16 + 0.5;
        const over = [...document.querySelectorAll<HTMLElement>("[data-testid=person-handoff] *")]
          .map((el) => ({ el, right: el.getBoundingClientRect().right }))
          .filter(({ el, right }) => right > limit && getComputedStyle(el).display !== "none" && el.closest(".truncate") === null)
          .map(({ el, right }) => `${el.tagName.toLowerCase()}.${el.className} ${Math.round(right)}`);
        return { over, scroll: document.documentElement.scrollWidth, width: window.innerWidth };
      });
      expect(fit.over).toEqual([]);
      expect(fit.scroll).toBeLessThanOrEqual(fit.width);
    } finally {
      await close();
    }
  });
});
