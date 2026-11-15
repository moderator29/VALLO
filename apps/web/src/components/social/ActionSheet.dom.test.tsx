/**
 * The post's `…` menu on the shared action sheet, mounted for real in
 * Chromium: Share, Save and Copy link as quick actions, every other act a row
 * with its sentence, the destructive rows last, Delete and Report handed to
 * the caller's own sheets, Block asked about first, and the close reported
 * only when nothing is waiting on an answer.
 *
 * Fictional handle; nothing is sent.
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
import { PORTED_CSS, axeViolations } from "@/components/ui/ported-test-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = [PORTED_CSS, readFileSync(join(process.cwd(), "src", "components", "ui", "action-sheet.css"), "utf8")].join("\n");

const entry = (mine: boolean) => `
  import { useState } from "react";
  import { ActionSheet, actionsForPost } from "@/components/social/ActionSheet";
  import { sheetWordsOf } from "@/components/social/sheet-words";
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  const sheet = sheetWordsOf(getDictionary("en"));
  function Harness() {
    const [up, setUp] = useState(true);
    window.__up = up;
    window.__chosen = window.__chosen || [];
    window.__closed = window.__closed || 0;
    return (
      <main style={{ padding: 16 }}>
        <button id="opener" style={{ minHeight: 44 }} onClick={() => setUp(true)}>More</button>
        {up ? (
          <ActionSheet
            label="What would you like to do?"
            actions={actionsForPost({ isMine: ${mine}, isAgentAuthor: false, hasListing: false, saved: false, reposted: false, repostCount: 3, editable: ${mine}, hasAuthor: true, who: "@ada_lekki" }, sheet.menu)}
            onChoose={(key) => window.__chosen.push(key)}
            onClose={() => { window.__closed += 1; setUp(false); }}
            body={sheet.body}
            dismissLabel={sheet.dismissLabel}
          />
        ) : null}
      </main>
    );
  }
  mount(<Harness />);
`;

type Win = { __up: boolean; __chosen: string[]; __closed: number };
const state = (page: import("playwright-core").Page) =>
  page.evaluate(() => {
    const w = window as unknown as Win;
    return { up: w.__up, chosen: w.__chosen, closed: w.__closed };
  });

describe.skipIf(!hasBrowser && !process.env.CI)("the post menu", () => {
  it("draws Share, Save and Copy link as quick actions and every other act as a row with its sentence, destructive last", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(false), css: CSS, reducedMotion: true });
    try {
      const dialog = page.getByRole("dialog", { name: "What would you like to do?" });
      await dialog.waitFor();
      expect(await dialog.locator(".nf-acts__quick-label").allTextContents()).toEqual(["Share", "Save", "Copy link"]);
      expect(await dialog.locator(".nf-acts__label").allTextContents()).toEqual(["Repost", "Mute @ada_lekki", "Report", "Block @ada_lekki"]);
      expect(await page.getByTestId("post-action-repost").locator(".nf-acts__hint").textContent()).toContain("Activity");
      expect(await dialog.locator('.nf-acts__row[data-danger="true"] .nf-acts__label').allTextContents()).toEqual(["Report", "Block @ada_lekki"]);
      for (const row of await dialog.locator(".nf-acts__row").all()) {
        expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(52);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("reports a quick action and a row, then the close, once each", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(false), css: CSS, reducedMotion: true });
    try {
      await page.getByRole("dialog").waitFor();
      await page.getByTestId("post-action-copy").click();
      await page.waitForFunction(() => (window as unknown as { __up: boolean }).__up === false);
      expect(await state(page)).toEqual({ up: false, chosen: ["copy"], closed: 1 });
      await page.locator("#opener").click();
      await page.getByRole("dialog").waitFor();
      await page.getByTestId("post-action-mute").click();
      await page.waitForFunction(() => (window as unknown as { __up: boolean }).__up === false);
      expect(await state(page)).toEqual({ up: false, chosen: ["copy", "mute"], closed: 2 });
    } finally {
      await close();
    }
  });

  it("asks before Block, in the row's own words, and blocks only on the answer", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(false), css: CSS, reducedMotion: true });
    try {
      await page.getByRole("dialog").waitFor();
      await page.getByTestId("post-action-block").click();
      const ask = page.getByRole("dialog", { name: "Block @ada_lekki?" });
      await ask.waitFor();
      expect(await ask.textContent()).toContain("You will not see each other anywhere on Vallo");
      expect(await state(page)).toEqual({ up: true, chosen: [], closed: 0 });
      await page.getByTestId("post-action-confirm-cancel").click();
      await page.waitForFunction(() => (window as unknown as { __up: boolean }).__up === false);
      expect(await state(page)).toEqual({ up: false, chosen: [], closed: 1 });

      await page.locator("#opener").click();
      await page.getByRole("dialog").waitFor();
      await page.getByTestId("post-action-block").click();
      await page.getByTestId("post-action-confirm-confirm").click();
      await page.waitForFunction(() => (window as unknown as { __up: boolean }).__up === false);
      expect(await state(page)).toEqual({ up: false, chosen: ["block"], closed: 2 });
    } finally {
      await close();
    }
  });

  it("hands Delete straight to the caller, whose own slide confirms it", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(true), css: CSS, reducedMotion: true });
    try {
      const dialog = page.getByRole("dialog", { name: "What would you like to do?" });
      await dialog.waitFor();
      expect(await dialog.locator(".nf-acts__label").allTextContents()).toEqual(["Repost", "Change what it says", "Delete this post"]);
      await page.getByTestId("post-action-delete").click();
      await page.waitForFunction(() => (window as unknown as { __up: boolean }).__up === false);
      expect(await state(page)).toEqual({ up: false, chosen: ["delete"], closed: 1 });
      expect(await page.getByRole("dialog").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("closes with Done and with Escape, choosing nothing", async () => {
    const { page, close } = await mountInBrowser({ entry: entry(false), css: CSS, reducedMotion: true });
    try {
      await page.getByRole("dialog").waitFor();
      await page.getByTestId("post-action-sheet-done").click();
      await page.waitForFunction(() => (window as unknown as { __up: boolean }).__up === false);
      await page.locator("#opener").click();
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => (window as unknown as { __up: boolean }).__up === false);
      expect(await state(page)).toEqual({ up: false, chosen: [], closed: 2 });
    } finally {
      await close();
    }
  });
});
