/**
 * BatchTray, mounted for real in Chromium: open only while something is
 * selected, unreachable while closed, the drag-down gesture and its button and
 * Escape equivalents, the count announced politely, and clear of the dock.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
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

const entry = (initial = 2) => `
  import { useState } from "react";
  import { BatchTray } from "@/components/ui/BatchTray";
  import { mount } from "@/lib/testing/browser-root";
  function Harness() {
    const [count, setCount] = useState(${initial});
    window.__count = count;
    window.__ran = window.__ran || [];
    return (
      <div style={{ minHeight: 600, padding: 16 }}>
        <button id="select" onClick={() => setCount((c) => c + 1)}>select one more</button>
        <BatchTray
          count={count}
          countLabel={count + " selected"}
          label="Bulk actions"
          clearLabel="Clear selection"
          onClear={() => setCount(0)}
          actions={[
            { id: "a", label: "Action one", icon: "archive", onSelect: () => window.__ran.push("a") },
            { id: "b", label: "Action two", onSelect: () => window.__ran.push("b"), disabled: true },
            { id: "c", label: "Action three", icon: "trash", tone: "danger", onSelect: () => window.__ran.push("c") },
          ]}
          data-testid="tray"
        />
      </div>
    );
  }
  mount(<Harness />);
`;

const isOpen = (page: Page) => page.getByTestId("tray").getAttribute("data-open");
const count = (page: Page) => page.evaluate(() => (window as unknown as { __count: number }).__count);

async function drag(page: Page, distance: number, settle = 0) {
  const box = (await page.locator(".nf-batch__grip").boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + distance / 2, { steps: 4 });
  await page.mouse.move(x, y + distance, { steps: 4 });
  if (settle) await page.waitForTimeout(settle);
  await page.mouse.up();
}

describe.skipIf(!hasBrowser && !process.env.CI)("BatchTray", () => {
  it("is open and named while something is selected, with the count announced politely", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: PORTED_CSS });
    try {
      await page.waitForTimeout(500);
      expect(await isOpen(page)).toBe("true");
      expect(await page.getByRole("toolbar", { name: "Bulk actions" }).isVisible()).toBe(true);
      const status = page.getByRole("status");
      expect(await status.getAttribute("aria-live")).toBe("polite");
      expect(await status.textContent()).toBe("2 selected");
      await page.locator("#select").click();
      expect(await status.textContent()).toBe("3 selected");
    } finally {
      await close();
    }
  });

  it("is closed, hidden and inert when nothing is selected, and rises when something is", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(0), css: PORTED_CSS });
    try {
      expect(await isOpen(page)).toBeNull();
      expect(await page.getByTestId("tray").evaluate((el) => getComputedStyle(el).visibility)).toBe("hidden");
      expect(await page.getByTestId("tray").evaluate((el) => (el as HTMLElement).inert)).toBe(true);
      expect(await page.getByRole("button", { name: "Action one" }).count()).toBe(0);
      /* The rise is read inside the page, frame by frame, from the click: the
         first frame the tray is visible and the frame after its animations
         finish. Reading it from the test process instead let a loaded
         machine miss most of the rise before the first read. */
      const { early, settled } = await page.evaluate(async () => {
        const tray = document.querySelector<HTMLElement>("[data-testid=tray]")!;
        const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));
        document.querySelector<HTMLElement>("#select")!.click();
        while (getComputedStyle(tray).visibility !== "visible") await frame();
        const first = tray.getBoundingClientRect().top;
        await frame();
        await Promise.all(
          [tray, ...tray.querySelectorAll<HTMLElement>("*")].flatMap((el) => el.getAnimations().map((a) => a.finished.catch(() => undefined))),
        );
        await frame();
        return { early: first, settled: tray.getBoundingClientRect().top };
      });
      expect(early).toBeGreaterThan(settled + 20);
      expect(await page.getByRole("button", { name: "Action one" }).isVisible()).toBe(true);
    } finally {
      await close();
    }
  });

  it("is fully usable with no framer-motion feature bundle, as production ships it (D49.1): visible, focusable, and the grip follows the finger", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: PORTED_CSS });
    try {
      await page.waitForTimeout(700);
      expect(await page.getByRole("toolbar", { name: "Bulk actions" }).isVisible()).toBe(true);
      await page.getByRole("button", { name: "Action one" }).focus();
      expect(await page.evaluate(() => document.activeElement?.textContent)).toContain("Action one");
      const box = (await page.locator(".nf-batch__grip").boundingBox())!;
      const before = (await page.locator(".nf-batch__surface").boundingBox())!.y;
      await page.mouse.move(box.x + box.width / 2, box.y + 10);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + 10 + 30, { steps: 5 });
      expect(Math.abs((await page.locator(".nf-batch__surface").boundingBox())!.y - before - 30)).toBeLessThan(2);
      await page.mouse.up();
    } finally {
      await close();
    }
  });

  it("runs an action, skips a disabled one, and marks a danger action as danger", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: PORTED_CSS });
    try {
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: "Action one" }).click();
      expect(await page.getByRole("button", { name: "Action two" }).isDisabled()).toBe(true);
      expect(await page.getByRole("button", { name: "Action three" }).getAttribute("class")).toContain("nf-btn--danger");
      await page.getByRole("button", { name: "Action three" }).click();
      expect(await page.evaluate(() => (window as unknown as { __ran: string[] }).__ran)).toEqual(["a", "c"]);
    } finally {
      await close();
    }
  });

  it("clears with the button, with Escape, and with a drag down past the threshold", async () => {
    for (const how of ["button", "escape", "drag"] as const) {
      const { page, close } = await mountInBrowser({ entry: entry(), css: PORTED_CSS });
      try {
        await page.waitForTimeout(500);
        if (how === "button") await page.getByRole("button", { name: "Clear selection" }).click();
        else if (how === "escape") {
          await page.getByRole("button", { name: "Action one" }).focus();
          await page.keyboard.press("Escape");
        } else await drag(page, 90, 150);
        expect(await count(page), how).toBe(0);
        await page.waitForFunction(() => getComputedStyle(document.querySelector("[data-testid=tray]")!).visibility === "hidden");
      } finally {
        await close();
      }
    }
  });

  it("follows the finger and springs back when dragged only a little", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: PORTED_CSS });
    try {
      await page.waitForTimeout(500);
      await page.waitForTimeout(500);
      const box = (await page.locator(".nf-batch__grip").boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      const before = (await page.locator(".nf-batch__surface").boundingBox())!.y;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + 30, { steps: 5 });
      const during = (await page.locator(".nf-batch__surface").boundingBox())!.y;
      expect(Math.abs(during - before - 30)).toBeLessThan(2);
      await page.waitForTimeout(200);
      await page.mouse.up();
      expect(await count(page)).toBe(2);
      await page.waitForTimeout(600);
      expect(Math.abs((await page.locator(".nf-batch__surface").boundingBox())!.y - before)).toBeLessThan(1.5);
    } finally {
      await close();
    }
  });

  it("sits clear of the dock, uses radius 32, and drops its blur under data saver", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry(),
      css: `${PORTED_CSS}\n:root { --nf-tabbar-clearance: 90px; }`,
      init: `document.body.insertAdjacentHTML("beforeend", '<main class="nf-main--docked"></main>'); document.documentElement.dataset.docked = ""; document.documentElement.dataset.saveData = "on";`,
    });
    try {
      await page.waitForTimeout(500);
      await page.waitForTimeout(700);
      const box = (await page.getByTestId("tray").boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(844 - 90 + 1);
      const surface = page.locator(".nf-batch__surface");
      expect(await surface.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe("32px");
      expect(await surface.evaluate((el) => getComputedStyle(el).backdropFilter)).toBe("none");
    } finally {
      await close();
    }
  });

  it("appears and leaves at once under reduced motion", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(), css: PORTED_CSS, reducedMotion: true });
    try {
      await page.waitForTimeout(60);
      const top = await page.getByTestId("tray").evaluate((el) => el.getBoundingClientRect().bottom);
      expect(top).toBeLessThan(844);
      await page.getByRole("button", { name: "Clear selection" }).click();
      await page.waitForTimeout(60);
      expect(await page.getByTestId("tray").evaluate((el) => getComputedStyle(el).visibility)).toBe("hidden");
    } finally {
      await close();
    }
  });

  it("passes axe in both themes", async () => {
    for (const theme of ["dark", "light"]) {
      const { page, close } = await mountInBrowser({ entry: entry(), css: PORTED_CSS });
      try {
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        await page.waitForTimeout(600);
        expect(await axeViolations(page), theme).toEqual([]);
      } finally {
        await close();
      }
    }
  });
});
