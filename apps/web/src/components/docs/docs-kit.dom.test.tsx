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
