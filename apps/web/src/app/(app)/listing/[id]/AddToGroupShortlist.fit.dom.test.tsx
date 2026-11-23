/**
 * ADD TO A GROUP SHORTLIST FITS A PHONE (23 November 2026).
 *
 * The same fault as Talk to a person: each group is named on one truncated
 * line beside its Add button, and the list around them was a grid with the
 * default auto column, which is as wide as the longest name, so a long group
 * name pushed every row and its Add button past the sheet's edge and the
 * sheet scrolled sideways on a 390px phone. This opens the real sheet in the
 * app's own stylesheet and checks no row reaches past the sheet's gutter.
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
  import { AddToGroupShortlist } from "@/app/(app)/listing/[id]/AddToGroupShortlist";
  mount(
    <div style={{ paddingInline: "16px" }}>
      <AddToGroupShortlist
        listingId="listing-1"
        groups={[
          { id: "g1", name: "Final year girls looking for a flat near Unilag main campus" },
          { id: "g2", name: "Yaba crew" },
        ]}
        words={{ open: "Add to group shortlist", title: "Add to a group", add: "Add", added: "Added to {group}" }}
      />
    </div>,
  );
`;

describe.skipIf(!hasBrowser && !process.env.CI)("add to a group shortlist on a phone", () => {
  it("keeps every group and its Add button inside the sheet's gutter", async () => {
    const css = await layoutCss("app/(app)/layout.tsx");
    const { page, close } = await mountInBrowser({ entry, css, viewport: { width: 390, height: 844 } });
    try {
      await page.getByTestId("listing-add-shortlist").click();
      const list = page.locator(".nf-sheet__body ul");
      await list.waitFor();
      await page.waitForTimeout(600);
      const fit = await list.evaluate((ul) => {
        const body = ul.closest<HTMLElement>(".nf-sheet__body")!;
        const limit = body.getBoundingClientRect().left + body.clientWidth - parseFloat(getComputedStyle(body).paddingRight) + 0.5;
        const over = [ul, ...ul.querySelectorAll<HTMLElement>("li, button")]
          .map((el) => ({ el, right: el.getBoundingClientRect().right }))
          .filter(({ right }) => right > limit)
          .map(({ el, right }) => `${el.tagName.toLowerCase()}.${el.className} ${Math.round(right)}`);
        return { over, scroll: body.scrollWidth, width: body.clientWidth, rows: ul.children.length };
      });
      expect(fit.rows).toBe(2);
      expect(fit.over).toEqual([]);
      expect(fit.scroll).toBeLessThanOrEqual(fit.width);
    } finally {
      await close();
    }
  });
});
