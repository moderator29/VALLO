/**
 * LiveIsland, mounted for real in Chromium: it draws only what it is told,
 * ticks steps only when told, announces politely, opens and closes without a
 * spinner anywhere, and never sits over the dock.
 */
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

/* A host that drives the steps from a button, standing in for the real thing
   finishing: the island itself owns no timer. */
const entry = (opts: { placement?: string; bare?: boolean } = {}) => `
  import { useState } from "react";
  import { LiveIsland } from "@/components/ui/LiveIsland";
  import { mount } from "@/lib/testing/browser-root";
  function Harness() {
    const [done, setDone] = useState(0);
    const steps = ["First step", "Second step", "Third step"].map((label, i) => ({
      id: "s" + i,
      label,
      state: i < done ? "done" : i === done ? "current" : "todo",
    }));
    window.__cancelled = window.__cancelled || 0;
    return (
      <div style={{ minHeight: 600, padding: 16 }}>
        <button id="advance" onClick={() => setDone((d) => d + 1)}>advance</button>
        <LiveIsland
          label="Live status"
          title="Title line"
          detail="Detail line"
          icon="clock"
          ${opts.placement ? `placement="${opts.placement}"` : ""}
          ${opts.bare ? "" : `steps={steps}
          stepStateLabels={{ done: "Done", current: "In progress", todo: "Waiting" }}
          progress={{ value: 0.4, label: "Progress" }}
          meta={<span>Meta line</span>}
          action={{ label: "Cancel it", onClick: () => { window.__cancelled += 1; } }}`}
          expandLabel="Show details"
          collapseLabel="Hide details"
          data-testid="island"
        />
      </div>
    );
  }
  mount(<Harness />);
`;

describe.skipIf(!hasBrowser && !process.env.CI)("LiveIsland", () => {
  it("is a named region with a polite live title and line", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: PORTED_CSS });
    try {
      expect(await page.getByRole("region", { name: "Live status" }).isVisible()).toBe(true);
      const status = page.locator('[role="status"]');
      expect(await status.getAttribute("aria-live")).toBe("polite");
      expect(await status.textContent()).toContain("Title line");
      expect(await status.textContent()).toContain("Detail line");
    } finally {
      await close();
    }
  });

  it("opens and closes its body, which is hidden and unreachable while closed", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: PORTED_CSS });
    try {
      const toggle = page.getByRole("button", { name: "Show details" });
      expect(await toggle.getAttribute("aria-expanded")).toBe("false");
      expect(await page.getByRole("button", { name: "Cancel it" }).count()).toBe(0);
      await toggle.click();
      expect(await page.getByRole("button", { name: "Hide details" }).getAttribute("aria-expanded")).toBe("true");
      await page.getByRole("button", { name: "Cancel it" }).waitFor();
      await page.getByRole("button", { name: "Cancel it" }).click();
      expect(await page.evaluate(() => (window as unknown as { __cancelled: number }).__cancelled)).toBe(1);
      await page.getByRole("button", { name: "Hide details" }).click();
      /* The exit finishes, then the body is hidden again. */
      await page.waitForFunction(() => getComputedStyle(document.querySelector(".nf-live__clip")!).visibility === "hidden");
      expect(await page.getByRole("button", { name: "Cancel it" }).count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("morphs: widens on a spring through the sizes in between, and can be turned round mid-flight", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: PORTED_CSS });
    try {
      await page.waitForTimeout(300);
      const width = () => page.getByTestId("island").evaluate((el) => el.getBoundingClientRect().width);
      const closed = await width();
      expect(Math.round(closed)).toBe(288);
      const samples = await page.evaluate(
        () =>
          new Promise<number[]>((resolve) => {
            const out: number[] = [];
            const el = document.querySelector("[data-testid=island]") as HTMLElement;
            (document.querySelector("[aria-label='Show details']") as HTMLElement).click();
            const tick = () => {
              out.push(el.getBoundingClientRect().width);
              if (out.length < 40) requestAnimationFrame(tick);
              else resolve(out);
            };
            tick();
          }),
      );
      expect(samples.filter((w) => w > closed + 4 && w < 412).length).toBeGreaterThan(2);
      await page.waitForTimeout(500);
      expect(Math.round(await width())).toBe(358);
      /* Collapse, and reverse before it has finished. */
      await page.getByRole("button", { name: "Hide details" }).click();
      await page.waitForTimeout(60);
      await page.getByRole("button", { name: "Show details" }).click();
      await page.waitForTimeout(900);
      expect(Math.round(await width())).toBe(358);
    } finally {
      await close();
    }
  });

  it("is fully usable with no framer-motion feature bundle, as production ships it (D49.1): opens, widens, shows the body, is clickable", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: PORTED_CSS });
    try {
      await page.waitForTimeout(300);
      const width = () => page.getByTestId("island").evaluate((el) => Math.round(el.getBoundingClientRect().width));
      expect(await width()).toBe(288);
      await page.getByRole("button", { name: "Show details" }).click();
      await page.getByRole("button", { name: "Cancel it" }).waitFor();
      await page.waitForTimeout(900);
      expect(await width()).toBe(358);
      expect(await page.getByRole("button", { name: "Hide details" }).getAttribute("aria-expanded")).toBe("true");
      await page.getByRole("button", { name: "Cancel it" }).click();
      expect(await page.evaluate(() => (window as unknown as { __cancelled: number }).__cancelled)).toBe(1);
    } finally {
      await close();
    }
  });

  it("ticks a step only when the host says so, and speaks every step's state", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: PORTED_CSS });
    try {
      await page.getByRole("button", { name: "Show details" }).click();
      const steps = page.locator(".nf-live__step");
      expect(await steps.nth(0).getAttribute("data-state")).toBe("current");
      expect(await steps.nth(0).getAttribute("aria-current")).toBe("step");
      expect(await steps.nth(1).textContent()).toContain("Waiting");
      /* Left alone, nothing advances: there is no timer in the component. */
      await page.waitForTimeout(800);
      expect(await steps.nth(0).getAttribute("data-state")).toBe("current");
      await page.locator("#advance").click();
      expect(await steps.nth(0).getAttribute("data-state")).toBe("done");
      expect(await steps.nth(0).textContent()).toContain("Done");
      expect(await steps.nth(1).getAttribute("data-state")).toBe("current");
    } finally {
      await close();
    }
  });

  it("draws a determinate bar with a name, a value and a transform fill", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: PORTED_CSS });
    try {
      await page.getByRole("button", { name: "Show details" }).click();
      const bar = page.getByRole("progressbar", { name: "Progress" });
      expect(await bar.getAttribute("aria-valuenow")).toBe("40");
      await page.waitForTimeout(500);
      const t = await page.locator(".nf-live__fill").evaluate((el) => getComputedStyle(el).transform);
      expect(t).toMatch(/^matrix\(0\.4,/);
    } finally {
      await close();
    }
  });

  it("has no toggle and no body when there is nothing to open", async () => {
    const { page, close } = await mountInBrowser({ entry: entry({ bare: true }), css: PORTED_CSS });
    try {
      expect(await page.getByRole("button", { name: "Show details" }).count()).toBe(0);
      expect(await page.locator(".nf-live__panel").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("sits clear of the dock at the bottom, using the dock clearance", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry({ placement: "bottom" }),
      css: `${PORTED_CSS}\n:root { --nf-tabbar-clearance: 90px; }`,
      init: `document.body.insertAdjacentHTML("beforeend", '<main class="nf-main--docked"></main>'); document.documentElement.dataset.docked = "";`,
    });
    try {
      /* Measured where it rests: the island rises into place, and on a loaded
         machine its entrance can still be in flight at the first frame. */
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
      const box = (await page.getByTestId("island").boundingBox())!;
      /* Its bottom edge is above the 90px the dock reserves. */
      expect(box.y + box.height).toBeLessThanOrEqual(844 - 90 + 1);
    } finally {
      await close();
    }
  });

  it("uses the Island radius and never a pill", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: PORTED_CSS });
    try {
      const r = await page.getByTestId("island").evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
      expect(r).toBe("32px");
    } finally {
      await close();
    }
  });

  it("drops the blur under data saver, and its entrance under reduced motion", async () => {
    const saver = await mountInBrowser({ entry: entry(), css: PORTED_CSS, init: `document.documentElement.dataset.saveData = "on";` });
    try {
      expect(await saver.page.getByTestId("island").evaluate((el) => getComputedStyle(el).backdropFilter)).toBe("none");
    } finally {
      await saver.close();
    }
    const calm = await mountInBrowser({ entry: entry(), css: PORTED_CSS, reducedMotion: true });
    try {
      expect(await calm.page.getByTestId("island").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    } finally {
      await calm.close();
    }
  });

  it("passes axe in both themes, closed and open", async () => {
    for (const theme of ["dark", "light"]) {
      const { page, close } = await mountInBrowser({ entry: entry(), css: PORTED_CSS });
      try {
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        await page.waitForTimeout(500);
        expect(await axeViolations(page), `${theme} closed`).toEqual([]);
        await page.getByRole("button", { name: "Show details" }).click();
        await page.waitForTimeout(500);
        expect(await axeViolations(page), `${theme} open`).toEqual([]);
      } finally {
        await close();
      }
    }
  });
});
