/**
 * THE DOCUMENTATION KIT, mounted for real in Chromium at 360px: the rich table
 * stays a table for a screen reader and never scrolls sideways, its state and
 * yes/no columns draw their marks, the index card is one link, the article
 * head carries its date, the contents card marks the section being read, and
 * axe finds nothing.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { axeViolations } from "@/components/ui/ported-test-css";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("app/css/docs-kit.css");

const entry = `
  import { DocCard, DocCardGrid } from "@/components/docs/DocCard";
  import { DocTable } from "@/components/docs/DocTable";
  import { DocHeader, DocSummary, DocCallout, DocSection } from "@/components/docs/DocArticle";
  import { DocToc } from "@/components/docs/DocToc";
  import { mount } from "@/lib/testing/browser-root";
  mount(
    <main style={{ width: 360, padding: 16 }}>
      <DocHeader category={{ icon: "file-text", label: "Legal" }} title="Payouts" updated="2026-11-09"
        related={[{ href: "/refunds", label: "Refunds" }, { href: "/fees", label: "Fees" }]}>
        <p>How your share reaches your bank.</p>
      </DocHeader>
      <DocSummary items={["Card payments are split at the moment of payment.", "Vallo never holds your money."]} />
      <DocCardGrid label="Documents">
        <DocCard href="/terms" icon="file-text" title="Terms of use" description="The rules for using Vallo." />
      </DocCardGrid>
      <DocTable caption="Payout states" columns={[
          { key: "state", label: "State", kind: "state" },
          { key: "means", label: "What it means" },
          { key: "out", label: "Withdrawable?", kind: "yesno" },
        ]}
        rows={[
          { id: "p", icon: "hourglass", cells: { state: { state: "Pending", tone: "pending" }, means: "The payment is clearing at the processor and nothing can move yet.", out: { yes: false } } },
          { id: "a", cells: { state: { state: "Paid", tone: "success" }, means: "In your bank account.", out: { yes: true } } },
        ]} />
      <DocCallout tone="not-live" title="Not open yet">Protected payment is built and switched off.</DocCallout>
      <DocToc sections={[{ id: "one", title: "First" }, { id: "two", title: "Second" }]} />
      <DocSection id="one" number={1} title="First"><p style={{ height: 1400 }}>One.</p></DocSection>
      <DocSection id="two" number={2} title="Second"><p style={{ height: 1400 }}>Two.</p></DocSection>
    </main>
  );
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the documentation kit", () => {
  it("keeps the rich table a table, draws its marks, and never scrolls sideways at 360px", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await page.setViewportSize({ width: 360, height: 800 });
      expect(await page.getByRole("table", { name: "Payout states" }).count()).toBe(1);
      expect(await page.getByRole("columnheader").count()).toBe(3);
      expect(await page.getByRole("row").count()).toBe(3);
      expect(await page.locator('.nf-doc-state[data-tone="pending"]').textContent()).toBe("Pending");
      expect(await page.locator('.nf-doc-yesno[data-yes="true"]').textContent()).toBe("Yes");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    } finally {
      await close();
    }
  });

  it("gives the index card one link, the head its date and related links, and passes axe", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      expect(await page.getByRole("link", { name: /Terms of use/ }).count()).toBe(1);
      expect(await page.locator("time").getAttribute("datetime")).toBe("2026-11-09");
      expect(await page.locator("time").textContent()).toBe("9 November 2026");
      expect(await page.getByRole("link", { name: /Refunds/ }).count()).toBe(1);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("marks the section being read in the contents card", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.evaluate(() => document.getElementById("two")?.scrollIntoView());
      await page.waitForFunction(() => document.querySelector('a[href="#two"]')?.getAttribute("aria-current") === "location");
      expect(await page.locator('a[href="#two"]').getAttribute("aria-current")).toBe("location");
    } finally {
      await close();
    }
  });
});

/*
 * THE ROW HEADER, WHICH IS A CELL LIKE ANY OTHER (11 November 2026, the docs
 * sweep). A row given a `head` draws `<th scope="row">` instead of a `<td>`,
 * and ninety rows across the offers and platform chapters use it. Only `td`
 * was ever styled, which cost the same thing twice:
 *
 *   on a phone  the stacking rules turned the row and its `td` cells into
 *               blocks and left the `th` a `table-cell`. A table-cell inside
 *               a block row is wrapped in an anonymous table box and sized to
 *               its CONTENT, so the row's subject drew as a narrow
 *               shrink-to-fit column beside full-width cells, and a long
 *               subject wrapped a word at a time while the cells under it
 *               read normally.
 *   on a desk   the `th` had no padding at all beside a padded `td`, so its
 *               text sat hard against the row's hairline.
 */
const headEntry = `
  import { DocTable } from "@/components/docs/DocTable";
  import { mount } from "@/lib/testing/browser-root";
  mount(
    <main style={{ width: 360, padding: 16 }}>
      <DocTable caption="What the deal room does" headLabel="What" columns={[
          { key: "what", label: "What" },
          { key: "means", label: "What it means" },
        ]}
        rows={[
          { head: "Inspection and due diligence before exchange", cells: { means: "The checks both sides agreed to, with every result on the record." } },
          { head: "Messages", cells: { means: "Every word, kept with the offer." } },
        ]} />
    </main>
  );
`;

describe.skipIf(!hasBrowser && !process.env.CI)("a documentation table whose rows have subjects", () => {
  /** The row header and the cell beside it, measured. */
  const measure = (page: import("playwright-core").Page) =>
    page.evaluate(() => {
      const th = document.querySelector('.nf-doc-table tbody th[scope="row"]');
      const row = th?.closest("tr");
      const td = row?.querySelector("td");
      if (!th || !row || !td) return null;
      return {
        display: getComputedStyle(th).display,
        thWidth: +th.getBoundingClientRect().width.toFixed(1),
        tdWidth: +td.getBoundingClientRect().width.toFixed(1),
        thPadding: getComputedStyle(th).paddingLeft,
        tdPadding: getComputedStyle(td).paddingLeft,
      };
    });

  it("stacks the row header with the rest of the row on a phone, at the row's full width", async () => {
    const { page, close } = await mountInBrowser({ entry: headEntry, css: CSS });
    try {
      await page.setViewportSize({ width: 360, height: 800 });
      const m = await measure(page);
      expect(m).not.toBeNull();
      /* Not `table-cell`: that is the anonymous table box that shrank it. */
      expect(m!.display).toBe("grid");
      /* And the same width as the cell under it, not its content's width. */
      expect(m!.thWidth).toBe(m!.tdWidth);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    } finally {
      await close();
    }
  });

  it("pads the row header exactly as the cell beside it on a desk", async () => {
    const { page, close } = await mountInBrowser({ entry: headEntry, css: CSS, viewport: { width: 1100, height: 800 } });
    try {
      const m = await measure(page);
      expect(m).not.toBeNull();
      expect(m!.display).toBe("table-cell");
      expect(m!.thPadding).toBe(m!.tdPadding);
      expect(Number.parseFloat(m!.thPadding)).toBeGreaterThan(0);
    } finally {
      await close();
    }
  });

  it("still reads as a table with row headers for a screen reader", async () => {
    const { page, close } = await mountInBrowser({ entry: headEntry, css: CSS });
    try {
      await page.setViewportSize({ width: 360, height: 800 });
      expect(await page.getByRole("table", { name: "What the deal room does" }).count()).toBe(1);
      expect(await page.getByRole("rowheader").count()).toBe(2);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });
});
