/**
 * A saved row at 390, mounted for real in Chromium with the shelf's own
 * stylesheet: the name gets the row and wraps between its words, the figure
 * sits compact on the right with its unit under it, and nothing is cut to
 * "Mini flat in...". Set `HUNTER_SHOTS_DIR` to also write a screenshot.
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

const WEB = join(__dirname, "..", "..", "..", "..");
const CSS = [PORTED_CSS, readFileSync(join(WEB, "src", "app", "css", "list-views.css"), "utf8"), "#root{padding:16px;display:grid;gap:12px;}"].join("\n");

const entry = `
  import { SavedShelf } from "@/app/(app)/saved/SavedShelf";
  import { mount } from "@/lib/testing/browser-root";
  const figure = (amount) => (<><span>{amount}</span><span className="nf-shelf__unit"> to move in</span></>);
  mount(
    <>
      <div className="nf-shelf-row" data-testid="row-short">
        <SavedShelf href="/listing/a" title="Mini flat in Yaba" where="Yaba, Lagos" photo={null} hue={210} kind="apartment" figure={figure("N1.8m")} status="For rent" verified={false} />
      </div>
      <div className="nf-shelf-row" data-testid="row-long">
        <SavedShelf href="/listing/b" title="Four bedroom duplex in New GRA" where="New GRA, Port Harcourt" photo={null} hue={30} kind="house" figure={figure("N7.5m")} status="For rent" verified={false} />
      </div>
    </>,
  );
`;

describe.skipIf(!hasBrowser)("a saved row on a phone", () => {
  it("gives the name the row: whole words, at most two lines, nothing clipped", async () => {
    for (const width of [390, 360]) {
      const { page, close } = await mountInBrowser({ entry, css: CSS, viewport: { width, height: 844 } });
      try {
        await page.waitForSelector('[data-testid="row-long"] .nf-shelf__title');
        const rows = await page.$$eval(".nf-shelf-row", (els) =>
          els.map((row) => {
            const title = row.querySelector(".nf-shelf__title")!;
            const figure = row.querySelector(".nf-shelf__figure")!;
            const shelf = row.querySelector(".nf-shelf")!;
            const t = title.getBoundingClientRect();
            const f = figure.getBoundingClientRect();
            const s = shelf.getBoundingClientRect();
            const line = parseFloat(getComputedStyle(title).lineHeight);
            return {
              text: title.textContent,
              lines: Math.round(t.height / line),
              clipped: title.scrollHeight > title.clientHeight + 1,
              titleWidth: Math.round(t.width),
              figureWidth: Math.round(f.width),
              figureRightGap: Math.round(s.right - f.right),
            };
          }),
        );
        for (const row of rows) {
          expect(row.clipped, row.text ?? "").toBe(false);
          expect(row.lines, row.text ?? "").toBeLessThanOrEqual(2);
          /* The name has the row beside the picture, not a 90px column. */
          expect(row.titleWidth, row.text ?? "").toBeGreaterThan(180);
          /* The figure is compact: its unit sits under it, not beside it. */
          expect(row.figureWidth, row.text ?? "").toBeLessThan(90);
        }
        expect(rows[0]?.lines).toBe(1);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        if (width === 390 && process.env.HUNTER_SHOTS_DIR) {
          await page.screenshot({ path: join(process.env.HUNTER_SHOTS_DIR, "saved-rows-390.png") });
        }
      } finally {
        await close();
      }
    }
  });
});
