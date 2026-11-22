/**
 * THE REGISTRATION GATES, PRESSED IN A REAL BROWSER (22 November 2026).
 *
 * `register-gates.test.ts` reads the source; this mounts the forms in
 * Chromium and does what an agent standing in a compound does:
 *
 *   - the agent fills the three questions on "About you" and Continue lights,
 *     with no NIN asked (the bug that stopped agents this morning); a phone
 *     number typed halfway keeps it dark, as the server would refuse it;
 *   - screen two waits for the eleven digit NIN it draws;
 *   - a server refusal of the NIN after Finish walks back to the screen
 *     that draws the NIN box, with the sentence beside it;
 *   - the firm's second screen waits for the chosen route's own field: an
 *     uploaded letter, or a principal's address.
 *
 * Example content only. The action is staged in the page; nothing is sent.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Page } from "playwright-core";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
} from "@/lib/testing/mount-in-browser";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(async () => {
  if (hasBrowser) await (await import("@/lib/testing/mount-in-browser")).warmBrowser();
});
afterAll(closeBrowser);

const entry = (form: "agent" | "firm", startAt = 0) => `
  import { mount } from "@/lib/testing/browser-root";
  import { getDictionary } from "@vallo/i18n";
  import { forRegister } from "@/components/supply/supply-copy";
  import { AgentRegisterForm } from "@/components/supply/AgentRegisterForm";
  import { FirmRegisterForm } from "@/components/supply/FirmRegisterForm";
  const t = forRegister(getDictionary("en"));
  mount(${
    form === "agent"
      ? `<AgentRegisterForm t={t} locale="en" startAt={${startAt}} />`
      : `<FirmRegisterForm t={t} startAt={${startAt}} />`
  });
`;

const primary = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

describe.skipIf(!hasBrowser)("agent registration, pressed", () => {
  it("About you lets the agent on without a NIN, and holds a half phone number", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("agent") });
    try {
      const go = primary(page, "Continue");
      expect(await go.isDisabled()).toBe(true);
      await page.getByLabel("Full name").fill("Ade Probe");
      await page.getByLabel("How long have you been working as an agent?").selectOption("1_2");
      await page.getByLabel("Phone number").fill("0803 12");
      expect(await go.isDisabled()).toBe(true);
      await page.getByLabel("Phone number").fill("08031234567");
      expect(await go.isDisabled()).toBe(false);
      await go.click();
      await page.getByLabel("National identity number (NIN)").waitFor();
      /* Screen two draws the NIN and waits for it. */
      expect(await primary(page, "Continue").isDisabled()).toBe(true);
      await page.getByLabel("National identity number (NIN)").fill("12345678901");
      expect(await primary(page, "Continue").isDisabled()).toBe(false);
    } finally {
      await close();
    }
  });

  it("a refused NIN walks back to the screen with the NIN box and its sentence", async () => {
    const { page, close } = await mountInBrowser({
      entry: entry("agent"),
      actions: {
        submitSupplyRegistration: `async () => ({ ok: false, error: "Please check the highlighted fields and try again.", fieldErrors: { nin: "Enter your 11-digit National Identity Number." } })`,
      },
    });
    try {
      await page.getByLabel("Full name").fill("Ade Probe");
      await page.getByLabel("How long have you been working as an agent?").selectOption("1_2");
      await page.getByLabel("Phone number").fill("08031234567");
      await primary(page, "Continue").click();
      await page.getByLabel("National identity number (NIN)").fill("12345678901");
      await primary(page, "Continue").click();
      /* The fees screen: tick both boxes, then Finish. */
      const boxes = page.getByRole("checkbox");
      for (let i = 0; i < (await boxes.count()); i += 1) await boxes.nth(i).check();
      await primary(page, "Finish").click();
      await page.getByLabel("National identity number (NIN)").waitFor();
      expect(await page.content()).toContain("Enter your 11-digit National Identity Number.");
    } finally {
      await close();
    }
  });
});

describe.skipIf(!hasBrowser)("firm registration, pressed", () => {
  it("the second screen waits for the chosen route's own field", async () => {
    const { page, close } = await mountInBrowser({ entry: entry("firm", 1) });
    try {
      const go = primary(page, "Continue");
      expect(await go.isDisabled()).toBe(true);
      /* The letter route, with nothing uploaded: still held. */
      await page.getByRole("radio", { name: /Upload a letter from your principal/ }).click();
      expect(await go.isDisabled()).toBe(true);
      /* The principal route waits for a whole address. */
      await page.getByRole("radio", { name: /Have your principal confirm you/ }).click();
      expect(await go.isDisabled()).toBe(true);
      await page.getByLabel("Your principal's email address").fill("principal@firm");
      expect(await go.isDisabled()).toBe(true);
      await page.getByLabel("Your principal's email address").fill("principal@firm.ng");
      expect(await go.isDisabled()).toBe(false);
    } finally {
      await close();
    }
  });
});
