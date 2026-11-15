/**
 * SAVING A HANDBOOK TO THE DEVICE, IN A REAL CHROMIUM.
 *
 * Two promises are made on every handbook and neither can be proved by
 * rendering to a string:
 *
 *   "Save as a file" hands the browser a real Markdown file, named for the
 *   position and the day, carrying the handbook's own headings. So the test
 *   presses the control and reads the file Chromium actually downloaded.
 *
 *   "Save as PDF" prints the handbook and none of the console around it. So
 *   the test puts the real view inside a stand-in console frame, switches the
 *   page to print media, and asks the browser what it would paint: the rail,
 *   the bar and the save controls gone, the handbook and its sections there.
 *
 * The stylesheet is handed in because the harness replaces a component's CSS
 * import with nothing; it is the same file the view imports.
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

const CSS = productCss(
  "app/css/docs-kit.css",
  "app/admin/handbook/position/handbook-print.css",
);

/** The real view, inside a stand-in console frame, so print has chrome to hide. */
const ENTRY = `
  import { mount } from "@/lib/testing/browser-root";
  import { PositionHandbookView } from "@/app/admin/handbook/position/PositionHandbookView";
  mount(
    <div>
      <nav data-testid="chrome-rail">The console rail</nav>
      <header data-testid="chrome-bar">The console bar</header>
      <main>
        <PositionHandbookView position="business_development_executive" own canReadEveryPosition />
      </main>
      <footer data-testid="chrome-dock">The dock</footer>
    </div>,
  );
`;

const display = (testId: string) =>
  `document.querySelector('[data-testid="${testId}"]') ? getComputedStyle(document.querySelector('[data-testid="${testId}"]')).display : "missing"`;

describe.skipIf(!hasBrowser && !process.env.CI)("saving a position handbook", () => {
  it("downloads a Markdown file named for the position, carrying the handbook's real headings", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: CSS });
    try {
      await page.getByTestId("handbook-save-file").waitFor();
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByTestId("handbook-save-file").click(),
      ]);
      expect(download.suggestedFilename()).toMatch(
        /^vallo-handbook-business-development-director-\d{4}-\d{2}-\d{2}\.md$/,
      );
      const path = await download.path();
      expect(path).toBeTruthy();
      const { readFileSync } = await import("node:fs");
      const file = readFileSync(path!, "utf8");

      /* The file is the handbook, not a stub. */
      expect(file.startsWith("# Vallo staff handbook: Business Development Director")).toBe(true);
      expect(file).toContain("/admin/handbook/position/business_development_executive");
      for (const heading of [
        "What this job is for",
        "Signing in to the console",
        "Your first day, and your first week",
        "Every desk you can open",
        "Step by step, the work itself",
        "What good looks like",
        "The words you use, and the words nobody at Vallo uses",
        "How to escalate",
        "Your copilot",
        "Who to go to, and where to get help",
      ]) {
        expect(file, heading).toContain(`. ${heading}`);
      }
      /* Its own words, from the role and from the shared sections. */
      expect(file).toContain("Vallo does not hold customer funds");
      expect(file).toContain("Add a prospect");
      expect(file).toContain("Business development");
      expect(file.length).toBeGreaterThan(20_000);
      expect(file).not.toMatch(/[<>]/);

      /* The object URL is revoked once the download has started. */
      await page.waitForTimeout(100);
      const leaked = await page.evaluate(() => document.querySelectorAll('a[href^="blob:"]').length);
      expect(leaked).toBe(0);

      /* The outcome is said by the one top banner, never beside the button. */
      await page.getByRole("status").first().waitFor({ timeout: 5_000 }).catch(() => undefined);
      const beside = await page.getByTestId("handbook-save").evaluate((el) => el.querySelectorAll('[role="alert"]').length);
      expect(beside).toBe(0);
    } finally {
      await close();
    }
  });

  it("prints the handbook and hides the console chrome and the controls", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: CSS });
    try {
      await page.getByTestId("handbook-save-pdf").waitFor();
      /* On screen: the chrome and both controls are there. */
      expect(await page.evaluate(display("chrome-rail"))).not.toBe("none");
      expect(await page.evaluate(display("handbook-save"))).not.toBe("none");

      await page.emulateMedia({ media: "print" });

      /* In print: no rail, no bar, no dock, no save controls, no contents card. */
      for (const testId of ["chrome-rail", "chrome-bar", "chrome-dock", "handbook-save"]) {
        expect(await page.evaluate(display(testId)), testId).toBe("none");
      }
      expect(
        await page.evaluate(
          `getComputedStyle(document.querySelector('.nf-hbp .nf-doc-toc')).display`,
        ),
      ).toBe("none");

      /* The handbook itself is still painted, and so are its sections. */
      const sheet = page.getByTestId("position-handbook-business_development_executive");
      expect(await sheet.evaluate((el) => getComputedStyle(el).display)).not.toBe("none");
      expect(await sheet.evaluate((el) => el.querySelectorAll("section.nf-doc-section").length)).toBeGreaterThanOrEqual(8);
      const section = await page.evaluate(
        `(() => { const el = document.querySelector('.nf-hbp .nf-doc-section:nth-of-type(2)') || document.querySelector('.nf-hbp .nf-doc-section'); const s = getComputedStyle(el); return { display: s.display, breakBefore: s.breakBefore }; })()`,
      );
      expect((section as { display: string }).display).not.toBe("none");

      /* A page break before each section, so a section starts on its own page. */
      const breaks = await page.evaluate(
        `[...document.querySelectorAll('.nf-hbp .nf-doc-section')].map((el) => getComputedStyle(el).breakBefore)`,
      );
      expect((breaks as string[]).filter((value) => value === "page").length).toBeGreaterThanOrEqual(8);

      /* The running foot carries the position and the date, on paper only. */
      const foot = await page.evaluate(
        `(() => { const el = document.querySelector('.nf-hbp-foot'); const s = getComputedStyle(el); return { display: s.display, position: s.position, text: el.textContent }; })()`,
      );
      const read = foot as { display: string; position: string; text: string };
      expect(read.display).toBe("block");
      expect(read.position).toBe("fixed");
      expect(read.text).toContain("Business Development Director");
      expect(read.text).toContain("November 2026");

      await page.emulateMedia({ media: "screen" });
      expect(await page.evaluate(`getComputedStyle(document.querySelector('.nf-hbp-foot')).display`)).toBe("none");
    } finally {
      await close();
    }
  });

  it("reads at 390px with no sideways scrolling and long words wrapped", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, css: CSS, viewport: { width: 390, height: 844 } });
    try {
      await page.getByTestId("handbook-save-pdf").waitFor();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
      /* Nothing in the article may break a word at any letter: `anywhere` and
         `break-all` count toward min-content width and shred a name. */
      const bad = await page.evaluate(
        `[...document.querySelectorAll('.nf-hbp *')].filter((el) => { const s = getComputedStyle(el); return s.overflowWrap === "anywhere" || s.wordBreak === "break-all"; }).length`,
      );
      expect(bad).toBe(0);
    } finally {
      await close();
    }
  });
});
