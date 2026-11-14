/**
 * ActionSheet, mounted for real in Chromium: the anatomy (head card, round
 * quick actions, rows card, Done bar), a destructive row forced last and
 * held behind the confirm, the Done bar and Escape closing it with focus
 * back on the opener, and axe over the open sheet in both themes.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

/* The harness does not follow a component's own CSS imports, so the sheets
   these parts stand on ride along. */
const WEB = join(__dirname, "..", "..", "..");
const CSS = [
  PORTED_CSS,
  readFileSync(join(WEB, "src", "app", "css", "list-views.css"), "utf8"),
  readFileSync(join(WEB, "src", "components", "ui", "action-sheet.css"), "utf8"),
].join("\n");

const entry = `
  import { useState } from "react";
  import { ActionSheet } from "@/components/ui/ActionSheet";
  import { mount } from "@/lib/testing/browser-root";
  window.__ran = [];
  function Demo() {
    const [open, setOpen] = useState(false);
    return (
      <div style={{ padding: 16 }}>
        <button id="opener" type="button" onClick={() => setOpen(true)}>Open</button>
        <ActionSheet
          open={open}
          onOpenChange={setOpen}
          title="Actions for Ada"
          testId="demo"
          head={{ name: "Ada", line: "Two bedroom in Lekki", icon: "user", onSelect: () => window.__ran.push("head") }}
          quick={[
            { key: "message", label: "Message", icon: "mail", onSelect: () => window.__ran.push("message"), "data-testid": "q-message" },
            { key: "call", label: "Call", icon: "phone", onSelect: () => window.__ran.push("call") },
            { key: "save", label: "Save", icon: "heart", on: true, onSelect: () => window.__ran.push("save"), "data-testid": "q-save" },
          ]}
          rows={[
            { key: "delete", label: "Delete this chat", icon: "trash", danger: true,
              confirm: { title: "Delete this chat?", line: "It is removed for you only.", confirmLabel: "Delete", cancelLabel: "Keep it" },
              onSelect: () => window.__ran.push("delete"), "data-testid": "row-delete" },
            { key: "pin", label: "Pin", icon: "bookmark", onSelect: () => window.__ran.push("pin"), "data-testid": "row-pin" },
            { key: "mute", label: "Mute", sub: "You still see the messages", icon: "mute", onSelect: () => window.__ran.push("mute"), "data-testid": "row-mute" },
            { key: "shared", label: "Shared media", icon: "image", chevron: true, onSelect: () => window.__ran.push("shared"), "data-testid": "row-shared" },
          ]}
          doneLabel="Done"
        />
      </div>
    );
  }
  mount(<Demo />);
`;

const ran = (page: import("playwright-core").Page) =>
  page.evaluate(() => (window as unknown as { __ran: string[] }).__ran);

describe.skipIf(!hasBrowser && !process.env.CI)("ActionSheet", () => {
  it("draws the head card, the round quick actions and the rows card, with Done apart from them", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await page.click("#opener");
      await page.waitForSelector('[data-testid="demo"]');
      /* One accessible name, from the hidden title, not a second heading. */
      expect(await page.getByRole("dialog", { name: "Actions for Ada" }).isVisible()).toBe(true);
      expect(await page.locator(".nf-asheet__name").textContent()).toBe("Ada");
      expect(await page.locator(".nf-asheet__line").textContent()).toBe("Two bedroom in Lekki");
      /* Three circles, each past the 44px floor and actually round. */
      const discs = page.locator(".nf-asheet__quickdisc");
      expect(await discs.count()).toBe(3);
      const shape = await discs.first().evaluate((el) => {
        const box = el.getBoundingClientRect();
        return { w: box.width, h: box.height, radius: getComputedStyle(el).borderRadius };
      });
      expect(shape.w).toBeGreaterThanOrEqual(44);
      expect(Math.round(shape.w)).toBe(Math.round(shape.h));
      expect(Number.parseFloat(shape.radius)).toBeGreaterThanOrEqual(shape.w / 2 - 1);
      /* A live quick action says so, rather than only looking different. */
      expect(await page.getByTestId("q-save").getAttribute("aria-pressed")).toBe("true");
      /* Rows are 52px or taller, and the Done bar is outside the rows card. */
      const rowBox = (await page.getByTestId("row-pin").boundingBox())!;
      expect(rowBox.height).toBeGreaterThanOrEqual(52);
      expect(await page.locator(".nf-asheet__rows [data-testid='demo-done']").count()).toBe(0);
      expect(await page.getByTestId("demo-done").isVisible()).toBe(true);
    } finally {
      await close();
    }
  });

  it("puts the destructive row last and runs it only after the confirm", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await page.click("#opener");
      await page.waitForSelector('[data-testid="demo"]');
      /* Passed first, drawn last. */
      const keys = await page.locator(".nf-asheet__rows .nf-list-item").evaluateAll((els) =>
        els.map((el) => el.querySelector("[data-testid]")?.getAttribute("data-testid") ?? ""),
      );
      expect(keys[keys.length - 1]).toBe("row-delete");
      await page.getByTestId("row-delete").click();
      /* The question replaces the sheet; nothing has run yet. */
      await page.waitForSelector('[data-testid="demo-confirm"]');
      expect(await ran(page)).toEqual([]);
      /* The sheet has gone, or is on its way out and already inert: `Sheet`
         keeps a leaving panel mounted so its exit can be seen. */
      const sheetGone = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="demo"]');
        return el === null || el.hasAttribute("inert");
      });
      expect(sheetGone).toBe(true);
      /* Saying no runs nothing. */
      await page.getByTestId("demo-confirm-cancel").click();
      await page.waitForSelector('[data-testid="demo-confirm"]', { state: "detached" });
      expect(await ran(page)).toEqual([]);
      /* Saying yes runs it. */
      await page.click("#opener");
      await page.getByTestId("row-delete").click();
      await page.getByTestId("demo-confirm-confirm").click();
      await page.waitForFunction(() => (window as unknown as { __ran: string[] }).__ran.length > 0);
      expect(await ran(page)).toEqual(["delete"]);
    } finally {
      await close();
    }
  });

  it("runs an ordinary row and closes, and a quick action does the same", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await page.click("#opener");
      await page.getByTestId("row-mute").click();
      await page.waitForSelector('[data-testid="demo"]', { state: "detached" });
      expect(await ran(page)).toEqual(["mute"]);
      await page.click("#opener");
      await page.getByTestId("q-message").click();
      await page.waitForSelector('[data-testid="demo"]', { state: "detached" });
      expect(await ran(page)).toEqual(["mute", "message"]);
    } finally {
      await close();
    }
  });

  it("closes on Done and on Escape, with the keyboard back on what opened it", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await page.click("#opener");
      await page.getByTestId("demo-done").click();
      await page.waitForSelector('[data-testid="demo"]', { state: "detached" });
      expect(await page.evaluate(() => document.activeElement?.id)).toBe("opener");
      expect(await ran(page)).toEqual([]);

      await page.click("#opener");
      await page.waitForSelector('[data-testid="demo"]');
      /* Focus is inside the sheet while it is open, not on the page behind. */
      expect(await page.evaluate(() => document.querySelector('[data-testid="demo"]')?.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Escape");
      await page.waitForSelector('[data-testid="demo"]', { state: "detached" });
      expect(await page.evaluate(() => document.activeElement?.id)).toBe("opener");
    } finally {
      await close();
    }
  });

  it("is clean to axe in both themes while open", async () => {
    for (const theme of ["dark", "light"] as const) {
      const { page, close } = await mountInBrowser({ entry, css: CSS });
      try {
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        await page.click("#opener");
        await page.waitForSelector('[data-testid="demo"]');
        expect(await axeViolations(page), theme).toEqual([]);
      } finally {
        await close();
      }
    }
  });
});
