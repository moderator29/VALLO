/**
 * CountTabs, mounted for real in Chromium: the three semantics (filters,
 * tabs, links), the count badge and its "9+" cap, nothing drawn at zero,
 * the 44px floor, tabs that never shrink in a row that scrolls, arrow keys
 * that move the choice, and the chosen tab keeping itself in view.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PORTED_CSS, axeViolations } from "./ported-test-css";
import { countWords } from "./CountTabs";

/* The harness does not follow a component's own CSS import, so the row's two
   sheets ride along: `.nf-scroll-x` (utilities.css) and the tab row's own. */
const WEB = join(__dirname, "..", "..", "..");
const CSS = [
  PORTED_CSS,
  readFileSync(join(WEB, "src", "app", "css", "utilities.css"), "utf8"),
  readFileSync(join(WEB, "src", "components", "ui", "count-tabs.css"), "utf8"),
].join("\n");

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

/* A 320px viewport box so seven tabs MUST overflow: the row has to scroll
   and a tab must keep its width rather than shrink into its neighbour. */
const filtersEntry = `
  import { useState } from "react";
  import { CountTabs } from "@/components/ui/CountTabs";
  import { mount } from "@/lib/testing/browser-root";
  function Filters() {
    const [active, setActive] = useState("all");
    return (
      <CountTabs
        label="Filter the list"
        active={active}
        onChange={setActive}
        data-testid="ftabs"
        items={[
          { key: "all", label: "All" },
          { key: "unread", label: "Unread", count: 12, "data-testid": "tab-unread" },
          { key: "requests", label: "Requests", count: 3, "data-testid": "tab-requests" },
          { key: "zero", label: "Zero", count: 0, "data-testid": "tab-zero" },
          { key: "property", label: "Property" },
          { key: "stays", label: "Stays" },
          { key: "archived", label: "Archived", "data-testid": "tab-archived" },
        ]}
      />
    );
  }
  mount(<div style={{ width: 320, padding: 16 }}><Filters /></div>);
`;

const linksEntry = `
  import { CountTabs } from "@/components/ui/CountTabs";
  import { mount } from "@/lib/testing/browser-root";
  mount(
    <div style={{ width: 320, padding: 16 }}>
      <CountTabs
        semantics="links"
        label="Filter saved by kind"
        active="restaurants"
        countCap={99}
        data-testid="ltabs"
        items={[
          { key: "all", label: "All", href: "/saved" },
          { key: "homes", label: "Homes", href: "/saved?kind=homes", count: 64 },
          { key: "stays", label: "Stays", href: "/saved?kind=stays", count: 120 },
          { key: "restaurants", label: "Restaurants", href: "/saved?kind=restaurants", "data-testid": "tab-active" },
        ]}
      />
    </div>
  );
`;

describe("countWords", () => {
  it("caps at nine by default and says the number under it", () => {
    expect(countWords(3)).toBe("3");
    expect(countWords(9)).toBe("9");
    expect(countWords(10)).toBe("9+");
    expect(countWords(120, 99)).toBe("99+");
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("CountTabs", () => {
  it("is a labelled radiogroup whose chosen tab is checked, with counts and no badge at zero", async () => {
    const { page, close } = await mountInBrowser({ entry: filtersEntry, css: CSS });
    try {
      const group = page.getByRole("radiogroup", { name: "Filter the list" });
      expect(await group.isVisible()).toBe(true);
      expect(await page.getByRole("radio", { name: /All/ }).getAttribute("aria-checked")).toBe("true");
      /* The counts: 12 is past the cap and says 9+; 0 draws nothing. */
      expect(await page.getByTestId("tab-unread").locator(".nf-counttabs__count").textContent()).toBe("9+");
      expect(await page.getByTestId("tab-requests").locator(".nf-counttabs__count").textContent()).toBe("3");
      expect(await page.getByTestId("tab-zero").locator(".nf-counttabs__count").count()).toBe(0);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("holds the 44px floor and never shrinks a tab: the row scrolls instead", async () => {
    const { page, close } = await mountInBrowser({ entry: filtersEntry, css: CSS });
    try {
      const box = (await page.getByTestId("tab-requests").boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      /* Seven tabs in 320px: the row overflows sideways and each tab keeps
         its full width (a shrunken tab ran its count under its neighbour). */
      const row = page.getByTestId("ftabs");
      const sizes = await row.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(sizes.scrollWidth).toBeGreaterThan(sizes.clientWidth);
      const whole = await page
        .getByTestId("tab-requests")
        .evaluate((el) => el.scrollWidth <= el.clientWidth && getComputedStyle(el).flexShrink === "0");
      expect(whole).toBe(true);
      /* And the page itself never scrolls sideways. */
      const pageScroll = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      expect(pageScroll).toBe(true);
    } finally {
      await close();
    }
  });

  it("moves the choice with the arrow keys and brings the chosen tab into view", async () => {
    const { page, close } = await mountInBrowser({ entry: filtersEntry, css: CSS });
    try {
      await page.getByRole("radio", { name: /All/ }).click();
      for (let i = 0; i < 6; i += 1) await page.keyboard.press("ArrowRight");
      expect(await page.getByTestId("tab-archived").getAttribute("aria-checked")).toBe("true");
      /* The last tab started past the 320px edge; choosing it scrolled the
         row (smooth, so give the scroll a moment to travel). */
      await page.waitForTimeout(600);
      const scrolled = await page.getByTestId("ftabs").evaluate((el) => el.scrollLeft > 0);
      expect(scrolled).toBe(true);
      /* And the group stays one tab stop: the chosen tab holds tabindex 0. */
      expect(await page.getByTestId("tab-archived").getAttribute("tabindex")).toBe("0");
    } finally {
      await close();
    }
  });

  it("as links it is a named navigation whose current tab says so, with its own cap", async () => {
    const { page, close } = await mountInBrowser({ entry: linksEntry, css: CSS });
    try {
      expect(await page.getByRole("navigation", { name: "Filter saved by kind" }).isVisible()).toBe(true);
      expect(await page.getByTestId("tab-active").getAttribute("aria-current")).toBe("page");
      const homes = page.getByRole("link", { name: /Homes/ });
      expect(await homes.getAttribute("href")).toBe("/saved?kind=homes");
      expect(await homes.locator(".nf-counttabs__count").textContent()).toBe("64");
      expect(await page.getByRole("link", { name: /Stays/ }).locator(".nf-counttabs__count").textContent()).toBe("99+");
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });
});
