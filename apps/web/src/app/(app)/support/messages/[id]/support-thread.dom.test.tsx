/**
 * THE SUPPORT CONVERSATION IN THE MESSAGES BUBBLE STYLE (Grade 1, job 10), on
 * the real `TicketThreadView` in Chromium: the Messages row, the two bubble
 * materials, the team's headset in the avatar's place, who and when under the
 * last bubble of a run, a run from one side sitting together, the day as a
 * chip, and a web address in a reply drawn as a link.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/css/threads.css", "app/css/grade1.css", "app/css/messages-g1.css");

const entry = `
  import { mount } from "@/lib/testing/browser-root";
  import { TicketThreadView } from "@/app/(app)/support/messages/[id]/ThreadView";
  import { NOW, RESOLVED_TICKET } from "@/app/(dev)/preview/support/fixtures";
  const at = (min) => new Date(NOW - min * 60_000).toISOString();
  const messages = [
    { id: "m1", senderRole: "admin", body: "Thanks, we are looking now.", createdAt: at(50), staffName: "Tunde" },
    { id: "m2", senderRole: "admin", body: "Details: https://vallo.ng/help/verification", createdAt: at(49), staffName: "Tunde" },
    { id: "m3", senderRole: "user", body: "Thank you", createdAt: at(10), staffName: null },
  ];
  mount(<TicketThreadView ticket={{ ...RESOLVED_TICKET, status: "pending", createdAt: at(60) }} messages={messages} attachments={[]} locale="en" now={NOW} />);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the support conversation", () => {
  it("draws the team's replies as a Messages run, with the byline under the last", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      const thread = page.getByTestId("support-thread");
      await thread.waitFor();
      const rows = await thread.locator("> li.nf-msg").evaluateAll((els) =>
        els.map((el) => ({ mine: el.classList.contains("nf-msg--mine"), run: el.getAttribute("data-run") })),
      );
      expect(rows).toEqual([
        { mine: true, run: "single" },
        { mine: false, run: "first" },
        { mine: false, run: "last" },
        { mine: true, run: "single" },
      ]);
      const admin = page.getByTestId("support-reply-admin");
      expect(await admin.first().locator(".nf-support-avatar").count()).toBe(1);
      expect(await admin.first().locator(".nf-msg__status").count()).toBe(0);
      expect(await admin.nth(1).locator(".nf-msg__status").textContent()).toContain("Tunde");
      expect(await admin.nth(1).locator("a.nf-bubble__link").getAttribute("href")).toBe("https://vallo.ng/help/verification");
      expect(await page.locator(".nf-bubble--mine").count()).toBe(2);
    } finally {
      await close();
    }
  });
});
