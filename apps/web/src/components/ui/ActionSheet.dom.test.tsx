/**
 * The action sheet, mounted for real in Chromium on top of the real Sheet:
 * the two cards and the Done bar, every row kind, the destructive rows last
 * and behind a confirm, the ways out, the 52 px rows, the fade under reduced
 * motion, the popover on a wide screen with a mouse, and both themes.
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

const WEB = join(__dirname, "..", "..", "..");
const CSS = [
  PORTED_CSS,
  readFileSync(join(WEB, "src", "app", "css", "controls.css"), "utf8"),
  readFileSync(join(__dirname, "action-sheet.css"), "utf8"),
].join("\n");

const entry = `
  import { useRef, useState } from "react";
  import { ActionSheet } from "@/components/ui/ActionSheet";
  import { mount } from "@/lib/testing/browser-root";
  function Harness() {
    const [open, setOpen] = useState(true);
    const [muted, setMuted] = useState(false);
    const [show, setShow] = useState("all");
    const [saved, setSaved] = useState(false);
    const opener = useRef(null);
    window.__open = open;
    window.__muted = muted;
    window.__show = show;
    window.__saved = saved;
    window.__chosen = window.__chosen || [];
    const did = (id) => () => window.__chosen.push(id);
    return (
      <main style={{ padding: 16, minHeight: 600 }}>
        <button id="opener" ref={opener} style={{ minHeight: 44, minWidth: 44, marginLeft: window.__openerLeft || 0 }} onClick={() => setOpen((v) => !v)}>More</button>
        <button id="elsewhere" style={{ position: "fixed", right: 16, bottom: 16, minHeight: 44 }}>Elsewhere</button>
        <ActionSheet
          open={open}
          onOpenChange={setOpen}
          title="Actions for Adaeze Okafor"
          anchor={opener}
          testId="acts"
          header={{ title: "Adaeze Okafor", subtitle: "2 bedroom serviced apartment, Lekki Phase 1", media: <span id="media" style={{ width: 44, height: 44 }} />, href: "#thread", testId: "acts-header" }}
          quick={[
            { id: "save", label: saved ? "Saved" : "Save", icon: "heart", active: saved, keepOpen: true, onSelect: () => setSaved((v) => !v), testId: "q-save" },
            { id: "share", label: "Share", icon: "share", onSelect: did("share"), testId: "q-share" },
            { id: "compare", label: "Compare", icon: "scale", onSelect: did("compare"), testId: "q-compare" },
            { id: "open", label: "Open", icon: "chat-bubble", href: "#open", testId: "q-open" },
            { id: "fifth", label: "Fifth", icon: "link", onSelect: did("fifth"), testId: "q-fifth" },
          ]}
          rows={[
            { id: "delete", kind: "danger", label: "Delete conversation", icon: "trash", onSelect: did("delete"), confirm: { title: "Delete this conversation?", line: "It is removed for you only.", confirmLabel: "Delete", cancelLabel: "Keep it" }, testId: "r-delete" },
            { id: "pin", label: "Pin", icon: "arrow-up", onSelect: did("pin"), testId: "r-pin" },
            { id: "media", label: "Shared media", hint: "Photos and files in this conversation", icon: "stack", href: "#media", testId: "r-media" },
            { id: "mute", kind: "switch", label: "Mute", hint: "No sound or banner for new messages", icon: "mute", checked: muted, onChange: setMuted, testId: "r-mute" },
            { id: "all", kind: "radio", group: "Show", label: "All messages", checked: show === "all", onSelect: () => setShow("all"), testId: "r-all" },
            { id: "unread", kind: "radio", group: "Show", label: "Unread only", checked: show === "unread", onSelect: () => setShow("unread"), testId: "r-unread" },
            { id: "report", kind: "danger", label: "Report", icon: "flag", onSelect: did("report"), confirm: "own", testId: "r-report" },
          ]}
        />
      </main>
    );
  }
  mount(<Harness />);
`;

type Win = { __open: boolean; __muted: boolean; __show: string; __saved: boolean; __chosen: string[] };
const state = (page: import("playwright-core").Page) =>
  page.evaluate(() => {
    const w = window as unknown as Win;
    return { open: w.__open, muted: w.__muted, show: w.__show, saved: w.__saved, chosen: w.__chosen };
  });

describe.skipIf(!hasBrowser && !process.env.CI)("ActionSheet", () => {
  it("is the platform sheet, named by its title, with no close X and one Done bar", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      const dialog = page.getByRole("dialog", { name: "Actions for Adaeze Okafor" });
      await dialog.waitFor();
      expect(await dialog.getAttribute("aria-modal")).toBe("true");
      const cls = (await dialog.getAttribute("class")) ?? "";
      expect(cls).toContain("nf-sheet");
      expect(cls).toContain("nf-acts-sheet");
      expect(await page.locator(".nf-sheet-backdrop").count()).toBe(1);
      expect(await dialog.getByRole("button", { name: "Close" }).count()).toBe(0);
      expect(await dialog.getByRole("button", { name: "Done", exact: true }).count()).toBe(1);
      /* Focus lands inside the sheet, on its content. */
      await page.waitForFunction(() => Boolean(document.activeElement?.closest(".nf-acts")));
    } finally {
      await close();
    }
  });

  it("draws a header card with at most four quick actions, then the rows with the destructive ones last", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await page.getByRole("dialog").waitFor();
      const head = page.getByTestId("acts-head");
      expect(await head.getByTestId("acts-header").getAttribute("href")).toBe("#thread");
      expect(await head.locator(".nf-acts__head-title").textContent()).toBe("Adaeze Okafor");
      expect(await head.locator(".nf-acts__head .nf-acts__chevron").count()).toBe(1);
      expect(await head.locator(".nf-acts__quick-btn").count()).toBe(4);
      expect(await page.getByTestId("q-fifth").count()).toBe(0);
      expect(await head.locator(".nf-acts__quick-btn .nf-plate--round").count()).toBe(4);
      const order = await page.getByTestId("acts-rows").locator(".nf-acts__label").allTextContents();
      expect(order).toEqual(["Pin", "Shared media", "Mute", "All messages", "Unread only", "Delete conversation", "Report"]);
      /* A link row carries the chevron; the second line is drawn. */
      expect(await page.getByTestId("r-media").locator(".nf-acts__chevron").count()).toBe(1);
      expect(await page.getByTestId("r-media").locator(".nf-acts__hint").textContent()).toContain("Photos and files");
      expect(await page.locator('.nf-acts__row[data-danger="true"]').count()).toBe(2);
    } finally {
      await close();
    }
  });

  it("keeps rows 52 px or taller, quick actions 44 px or more, and the page from scrolling sideways", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await page.getByRole("dialog").waitFor();
      await page.waitForTimeout(500);
      for (const row of await page.locator(".nf-acts__row").all()) {
        expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(52);
      }
      for (const quick of await page.locator(".nf-acts__quick-btn").all()) {
        const box = (await quick.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
      expect((await page.getByTestId("acts-done").boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const fit = await page.evaluate(() => {
        const sheet = document.querySelector(".nf-sheet")!.getBoundingClientRect();
        const body = document.querySelector(".nf-sheet__body")!;
        return {
          page: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          body: body.scrollWidth <= body.clientWidth,
          inside: [...document.querySelectorAll(".nf-acts__card, [data-testid='acts-done']")].every((el) => {
            const b = el.getBoundingClientRect();
            return b.left >= sheet.left && b.right <= sheet.right;
          }),
        };
      });
      expect(fit).toEqual({ page: true, body: true, inside: true });
    } finally {
      await close();
    }
  });

  it("runs an action and closes; a toggle, a switch and a radio change in place and stay open", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await page.getByRole("dialog").waitFor();
      await page.getByTestId("q-save").click();
      expect(await state(page)).toMatchObject({ saved: true, open: true });
      expect(await page.getByTestId("q-save").getAttribute("aria-pressed")).toBe("true");

      /* The switch is named by its row, and a press on the row's words turns it. */
      const mute = page.getByRole("switch", { name: "Mute" });
      expect(await mute.getAttribute("aria-checked")).toBe("false");
      await page.locator(".nf-acts__row--control .nf-acts__label").click();
      expect(await state(page)).toMatchObject({ muted: true, open: true });
      expect(await mute.getAttribute("aria-checked")).toBe("true");

      const group = page.getByRole("radiogroup", { name: "Show" });
      expect(await group.getByRole("radio").count()).toBe(2);
      await page.getByTestId("r-unread").click();
      expect(await state(page)).toMatchObject({ show: "unread", open: true });
      expect(await page.getByTestId("r-unread").getAttribute("aria-checked")).toBe("true");
      await page.getByTestId("r-unread").focus();
      await page.keyboard.press("ArrowUp");
      expect(await state(page)).toMatchObject({ show: "all", open: true });

      await page.getByTestId("r-pin").click();
      expect(await state(page)).toMatchObject({ chosen: ["pin"], open: false });
    } finally {
      await close();
    }
  });

  it("asks before a destructive row runs, and leaves a caller's own confirm to the caller", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS });
    try {
      await page.getByRole("dialog").waitFor();
      await page.getByTestId("r-delete").click();
      const confirm = page.getByRole("dialog", { name: "Delete this conversation?" });
      await confirm.waitFor();
      expect(await state(page)).toMatchObject({ chosen: [], open: false });
      await page.getByTestId("acts-confirm-cancel").click();
      await confirm.waitFor({ state: "detached" });
      expect((await state(page)).chosen).toEqual([]);

      await page.locator("#opener").click();
      await page.getByRole("dialog", { name: "Actions for Adaeze Okafor" }).waitFor();
      await page.getByTestId("r-delete").click();
      await page.getByTestId("acts-confirm-confirm").click();
      expect((await state(page)).chosen).toEqual(["delete"]);

      await page.getByRole("dialog", { name: "Delete this conversation?" }).waitFor({ state: "detached" });
      await page.locator("#opener").click();
      await page.getByRole("dialog", { name: "Actions for Adaeze Okafor" }).waitFor();
      await page.getByTestId("r-report").click();
      expect(await state(page)).toMatchObject({ chosen: ["delete", "report"], open: false });
      expect(await page.getByRole("dialog", { name: "Delete this conversation?" }).count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("closes with Done, with the scrim and with Escape, and gives focus back to what opened it", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS, reducedMotion: true });
    try {
      const dialog = page.getByRole("dialog", { name: "Actions for Adaeze Okafor" });
      await dialog.waitFor();
      await page.getByTestId("acts-done").click();
      expect((await state(page)).open).toBe(false);

      await page.locator("#opener").click();
      await dialog.waitFor();
      await page.locator(".nf-sheet-backdrop").click({ position: { x: 20, y: 20 } });
      expect((await state(page)).open).toBe(false);

      await page.locator("#opener").focus();
      await page.keyboard.press("Enter");
      await dialog.waitFor();
      /* Tab cannot leave the sheet. */
      for (let i = 0; i < 16; i += 1) await page.keyboard.press("Tab");
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".nf-sheet")))).toBe(true);
      await page.keyboard.press("Escape");
      expect((await state(page)).open).toBe(false);
      await page.waitForFunction(() => document.activeElement?.id === "opener");
    } finally {
      await close();
    }
  });

  it("fades under reduced motion instead of sliding", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS, reducedMotion: true });
    try {
      const dialog = page.getByRole("dialog", { name: "Actions for Adaeze Okafor" });
      await dialog.waitFor();
      const style = await dialog.evaluate((el) => {
        const s = getComputedStyle(el);
        return { property: s.transitionProperty, duration: s.transitionDuration };
      });
      expect(style.property).toBe("opacity");
      expect(parseFloat(style.duration)).toBeGreaterThan(0.05);
      await page.waitForFunction(() => getComputedStyle(document.querySelector(".nf-sheet")!).opacity === "1");
      /* At rest it sits on the bottom edge: nothing left of the slide. */
      const rest = await dialog.evaluate((el) => Math.round(window.innerHeight - el.getBoundingClientRect().bottom));
      expect(rest).toBe(0);
    } finally {
      await close();
    }
  });

  it("is a popover hung from its trigger on a wide screen with a mouse: no scrim, no Done bar", async () => {
    const { page, close } = await mountInBrowser({ entry, css: CSS, viewport: { width: 1440, height: 900 }, init: "window.__openerLeft = 1340;" });
    try {
      const pop = page.getByRole("dialog", { name: "Actions for Adaeze Okafor" });
      await pop.waitFor();
      expect(await pop.getAttribute("class")).toContain("nf-acts-pop");
      expect(await page.locator(".nf-sheet-backdrop").count()).toBe(0);
      expect(await page.getByTestId("acts-done").count()).toBe(0);
      await page.waitForFunction(() => document.querySelector(".nf-acts-pop")?.getAttribute("data-placed") === "true");
      const at = await page.evaluate(() => {
        const p = document.querySelector(".nf-acts-pop")!.getBoundingClientRect();
        const o = document.querySelector("#opener")!.getBoundingClientRect();
        return { left: p.left, right: p.right, top: p.top, bottom: p.bottom, width: p.width, oRight: o.right, oBottom: o.bottom, vw: document.documentElement.clientWidth, vh: window.innerHeight };
      });
      /* Wholly on screen, under the trigger, hung from its end edge because
         the start edge would run off the window. */
      expect(at.left).toBeGreaterThanOrEqual(8);
      expect(at.right).toBeLessThanOrEqual(at.vw - 8 + 0.5);
      expect(at.bottom).toBeLessThanOrEqual(at.vh - 8 + 0.5);
      expect(Math.abs(at.top - (at.oBottom + 8))).toBeLessThanOrEqual(1);
      expect(Math.abs(at.right - at.oRight)).toBeLessThanOrEqual(1);
      expect(at.width).toBeLessThanOrEqual(352.5);
      /* Focus is inside and Tab stays inside. */
      await page.waitForFunction(() => Boolean(document.activeElement?.closest(".nf-acts-pop")));
      for (let i = 0; i < 16; i += 1) await page.keyboard.press("Tab");
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".nf-acts-pop")))).toBe(true);
      /* A press elsewhere closes it. */
      await page.locator("#elsewhere").click();
      expect((await state(page)).open).toBe(false);
      /* Opened from its trigger, Escape closes it and focus goes back there. */
      await page.locator("#opener").click();
      await pop.waitFor();
      await page.keyboard.press("Escape");
      expect((await state(page)).open).toBe(false);
      await page.waitForFunction(() => document.activeElement?.id === "opener");
      /* The destructive row still asks, in the shared confirm. */
      await page.locator("#opener").click();
      await pop.waitFor();
      await page.getByTestId("r-delete").click();
      await page.getByRole("dialog", { name: "Delete this conversation?" }).waitFor();
    } finally {
      await close();
    }
  });

  it("passes axe in both themes, as a sheet and as a popover", async () => {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      for (const theme of ["dark", "light"]) {
        const { page, close } = await mountInBrowser({ entry, css: CSS, viewport });
        try {
          await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
          await page.getByRole("dialog").waitFor();
          await page.waitForTimeout(600);
          expect(await axeViolations(page), `${viewport.width} ${theme}`).toEqual([]);
        } finally {
          await close();
        }
      }
    }
  });
});
