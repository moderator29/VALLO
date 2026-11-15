/**
 * The count tabs, mounted for real in Chromium at a phone's width: the two
 * meanings (a radiogroup that filters, a tablist that switches a panel), the
 * count's rules, the 44 px floor, a row that scrolls where the page does not,
 * the chosen tab brought into view, the arrow keys, and both themes.
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
import { PORTED_CSS, axeViolations } from "./ported-test-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = [PORTED_CSS, readFileSync(join(__dirname, "count-tabs.css"), "utf8")].join("\n");

const entry = (mode: "filter" | "tabs", start = "all") => `
  import { useState } from "react";
  import { CountTabs } from "@/components/ui/CountTabs";
  import { mount } from "@/lib/testing/browser-root";
  const ITEMS = [
    { key: "all", label: "All", testId: "t-all" },
    { key: "unread", label: "Unread", count: 3, testId: "t-unread" },
    { key: "requests", label: "Requests", count: 12, testId: "t-requests" },
    { key: "support", label: "Support", count: 0, testId: "t-support" },
    { key: "archived", label: "Archived", testId: "t-archived" },
    { key: "reported", label: "Reported and blocked", count: 1, testId: "t-reported" },
  ];
  function Harness() {
    const [value, setValue] = useState(${JSON.stringify(start)});
    window.__value = value;
    return (
      <main style={{ padding: 16 }}>
        <CountTabs
          label="Show"
          items={ITEMS}
          value={value}
          onChange={setValue}
          mode=${JSON.stringify(mode)}
          idPrefix="tab"
          panelId="panel"
          countLabel={(n) => n + " new"}
          trailing={<button type="button" id="trailing" style={{ minHeight: 44 }}>New list</button>}
          testId="tabs"
        />
        <div id="panel" role={${JSON.stringify(mode)} === "tabs" ? "tabpanel" : undefined} aria-labelledby={${JSON.stringify(mode)} === "tabs" ? "tab-" + value : undefined}>
          Panel
        </div>
      </main>
    );
  }
  mount(<Harness />);
`;

const value = (page: import("playwright-core").Page) =>
  page.evaluate(() => (window as unknown as { __value: string }).__value);

describe.skipIf(!hasBrowser && !process.env.CI)("CountTabs", () => {
  it("is a radiogroup of radios when it filters, with one stop in the tab order", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("filter"), css: CSS });
    try {
      const group = page.getByRole("radiogroup", { name: "Show" });
      await group.waitFor();
      expect(await group.getByRole("radio").count()).toBe(6);
      expect(await page.getByTestId("t-all").getAttribute("aria-checked")).toBe("true");
      expect(await page.getByTestId("t-unread").getAttribute("aria-checked")).toBe("false");
      expect(await group.locator('[tabindex="0"]').count()).toBe(1);
      /* The trailing control sits outside the group, in the same scroller. */
      expect(await group.locator("#trailing").count()).toBe(0);
      expect(await page.locator(".nf-count-tabs__row #trailing").count()).toBe(1);
    } finally {
      await close();
    }
  });

  it("is a tablist of tabs that control the panel when it switches one", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("tabs"), css: CSS });
    try {
      const list = page.getByRole("tablist", { name: "Show" });
      await list.waitFor();
      expect(await list.getByRole("tab").count()).toBe(6);
      const first = page.getByTestId("t-all");
      expect(await first.getAttribute("aria-selected")).toBe("true");
      expect(await first.getAttribute("aria-controls")).toBe("panel");
      expect(await first.getAttribute("id")).toBe("tab-all");
    } finally {
      await close();
    }
  });

  it("shows a number, 9+ past nine and nothing at zero, and says the whole number", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("filter"), css: CSS });
    try {
      await page.getByRole("radiogroup").waitFor();
      expect(await page.getByTestId("t-unread").locator("[data-count-badge]").textContent()).toBe("3");
      expect(await page.getByTestId("t-requests").locator("[data-count-badge]").textContent()).toBe("9+");
      expect(await page.getByTestId("t-support").locator("[data-count-badge]").count()).toBe(0);
      expect(await page.getByTestId("t-all").locator("[data-count-badge]").count()).toBe(0);
      /* The badge is hidden from a screen reader; the whole number is said. */
      expect(await page.getByRole("radio", { name: /^Requests\s*, 12 new$/ }).count()).toBe(1);
      expect(await page.getByRole("radio", { name: /^Unread\s*, 3 new$/ }).count()).toBe(1);
      expect(await page.getByRole("radio", { name: "All", exact: true }).count()).toBe(1);
    } finally {
      await close();
    }
  });

  it("keeps every tab 44 px or more, never shrinks one, and scrolls the row, not the page", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("filter"), css: CSS });
    try {
      await page.getByRole("radiogroup").waitFor();
      const tabs = await page.locator("[data-count-tab]").all();
      let previousRight = -Infinity;
      for (const tab of tabs) {
        const box = await tab.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { w: r.width, h: r.height, left: r.left, right: r.right, sw: el.scrollWidth, cw: el.clientWidth };
        });
        expect(box.h).toBeGreaterThanOrEqual(44);
        expect(box.w).toBeGreaterThanOrEqual(44);
        /* Nothing inside a tab is clipped or pushed under its neighbour. */
        expect(box.sw).toBeLessThanOrEqual(box.cw);
        expect(box.left).toBeGreaterThanOrEqual(previousRight);
        previousRight = box.right;
      }
      /* A count sits wholly inside its own tab. */
      const inside = await page.locator("[data-count-badge]").evaluateAll((els) =>
        els.every((el) => {
          const b = el.getBoundingClientRect();
          const t = el.closest("[data-count-tab]")!.getBoundingClientRect();
          return b.left >= t.left && b.right <= t.right;
        }),
      );
      expect(inside).toBe(true);
      const scroll = await page.evaluate(() => {
        const row = document.querySelector(".nf-count-tabs__row")!;
        return {
          row: row.scrollWidth > row.clientWidth,
          page: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          bar: getComputedStyle(row).scrollbarWidth,
        };
      });
      expect(scroll.row).toBe(true);
      expect(scroll.page).toBe(true);
      expect(scroll.bar).toBe("none");
    } finally {
      await close();
    }
  });

  it("brings the chosen tab into view on first paint and after a choice", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("filter", "reported"), css: CSS, reducedMotion: true });
    try {
      await page.getByRole("radiogroup").waitFor();
      const inView = (testId: string) =>
        page.evaluate((id) => {
          const row = document.querySelector(".nf-count-tabs__row")!.getBoundingClientRect();
          const tab = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
          return tab.left >= row.left - 0.5 && tab.right <= row.right + 0.5;
        }, testId);
      await page.waitForFunction(() => document.querySelector(".nf-count-tabs__row")!.scrollLeft > 0);
      expect(await inView("t-reported")).toBe(true);
      /* Home goes back to the first tab, which is scrolled back into view. */
      await page.getByTestId("t-reported").focus();
      await page.keyboard.press("Home");
      expect(await value(page)).toBe("all");
      await page.waitForFunction(() => document.querySelector(".nf-count-tabs__row")!.scrollLeft === 0);
      expect(await inView("t-all")).toBe(true);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    } finally {
      await close();
    }
  });

  it("moves and chooses with the arrow keys, Home and End, wrapping at the ends", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("tabs"), css: CSS, reducedMotion: true });
    try {
      await page.getByRole("tablist").waitFor();
      await page.getByTestId("t-all").focus();
      await page.keyboard.press("ArrowRight");
      expect(await value(page)).toBe("unread");
      expect(await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))).toBe("t-unread");
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");
      expect(await value(page)).toBe("reported");
      expect(await page.evaluate(() => document.activeElement?.getAttribute("data-testid"))).toBe("t-reported");
      await page.keyboard.press("ArrowRight");
      expect(await value(page)).toBe("all");
      await page.keyboard.press("End");
      expect(await value(page)).toBe("reported");
      await page.getByTestId("t-requests").click();
      expect(await value(page)).toBe("requests");
      expect(await page.getByTestId("t-requests").getAttribute("aria-selected")).toBe("true");
    } finally {
      await close();
    }
  });

  it("passes axe in both themes and both meanings", async () => {
    for (const mode of ["filter", "tabs"] as const) {
      for (const theme of ["dark", "light"]) {
        const { page, close } = await mountInBrowser({ entry: entry(mode, "unread"), css: CSS });
        try {
          await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
          await page.locator("[data-count-tab]").first().waitFor();
          await page.waitForTimeout(300);
          expect(await axeViolations(page), `${mode} ${theme}`).toEqual([]);
        } finally {
          await close();
        }
      }
    }
  });
});
