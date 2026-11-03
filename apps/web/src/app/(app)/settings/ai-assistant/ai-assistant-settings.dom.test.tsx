/**
 * VALLO AI Assistant settings, mounted for real in Chromium: the agreement
 * screen keeps Activate disabled until all three ticks are made and then calls
 * the one action; the master switch is never switched on in place and turning
 * it off asks first and then calls the deactivate action; each permission
 * switch calls the permission action with its own key and the direction.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

/* The harness records every action call as [name, ...args] on `window.__calls`. */
const OK = "async () => ({ ok: true, data: null })";
const ACTIONS = {
  activateAssistant: OK,
  deactivateAssistant: OK,
  setAssistantPermission: OK,
  clearLearnedPreferences: OK,
  setLearnedPreference: OK,
};
const calls = async (page: import("playwright-core").Page) => {
  const raw = await page.evaluate(() => (window as unknown as { __calls?: unknown[][] }).__calls ?? []);
  return raw.map(([name, input]) => ({ name: name as string, input }));
};

describe.skipIf(!hasBrowser && !process.env.CI)("VALLO AI Assistant settings", () => {
  it("keeps Activate disabled until the terms, the privacy policy and the agreement are all ticked", async () => {
    const { page, close } = await mountInBrowser({
      actions: ACTIONS,
      entry: `
        import { mount } from "@/lib/testing/browser-root";
        import { ConsentForm } from "@/app/(app)/settings/ai-assistant/consent/ConsentForm";
        mount(<ConsentForm />);
      `,
    });
    try {
      const button = page.getByTestId("ai-activate");
      expect(await button.isDisabled()).toBe(true);
      await page.getByTestId("ai-accept-terms").check();
      expect(await button.isDisabled()).toBe(true);
      await page.getByTestId("ai-accept-privacy").check();
      expect(await button.isDisabled()).toBe(true);
      await page.getByTestId("ai-agree").check();
      expect(await button.isDisabled()).toBe(false);
      await button.click();
      await page.waitForFunction(() => ((window as unknown as { __calls?: unknown[] }).__calls ?? []).length > 0);
      const [first] = await calls(page);
      expect(first?.name).toBe("activateAssistant");
      expect(first?.input).toMatchObject({ acceptTerms: true, acceptPrivacy: true, agree: true, permissions: ["discovery"] });
    } finally {
      await close();
    }
  });

  it("starts OFF, and the master switch never turns the assistant on in place", async () => {
    const { page, close } = await mountInBrowser({
      actions: ACTIONS,
      entry: `
        import { mount } from "@/lib/testing/browser-root";
        import { MasterSwitch } from "@/app/(app)/settings/ai-assistant/AssistantControls";
        mount(<MasterSwitch enabled={false} />);
      `,
    });
    try {
      const sw = page.getByTestId("ai-master-switch");
      expect(await sw.getAttribute("aria-checked")).toBe("false");
      await sw.click();
      expect((await calls(page)).length).toBe(0);
    } finally {
      await close();
    }
  });

  it("asks before turning the assistant off, says what changes, then calls deactivate", async () => {
    const { page, close } = await mountInBrowser({
      actions: ACTIONS,
      entry: `
        import { mount } from "@/lib/testing/browser-root";
        import { MasterSwitch } from "@/app/(app)/settings/ai-assistant/AssistantControls";
        mount(<MasterSwitch enabled />);
      `,
    });
    try {
      await page.getByTestId("ai-master-switch").click();
      const confirm = page.getByTestId("ai-off-confirm");
      await confirm.waitFor();
      expect(await confirm.innerText()).toContain("taken back");
      expect((await calls(page)).length).toBe(0);
      await page.getByTestId("ai-off-yes").click();
      await page.waitForFunction(() => ((window as unknown as { __calls?: unknown[] }).__calls ?? []).length > 0);
      expect((await calls(page))[0]?.name).toBe("deactivateAssistant");
    } finally {
      await close();
    }
  });

  it("calls the permission action with the right key and direction, read and act kept apart on screen", async () => {
    const { page, close } = await mountInBrowser({
      actions: ACTIONS,
      entry: `
        import { mount } from "@/lib/testing/browser-root";
        import { PermissionRows } from "@/app/(app)/settings/ai-assistant/AssistantControls";
        mount(<PermissionRows granted={["discovery", "transactions"]} />);
      `,
    });
    try {
      const text = await page.getByTestId("ai-perm-transactions").innerText();
      expect(text).toContain("Reads");
      expect(text).toContain("Sensitive");
      expect(await page.getByTestId("ai-perm-payment_assist").innerText()).toContain("Acts");
      expect(await page.getByTestId("ai-perm-switch-transactions").getAttribute("aria-checked")).toBe("true");
      expect(await page.getByTestId("ai-perm-switch-wallet_balance").getAttribute("aria-checked")).toBe("false");
      await page.getByTestId("ai-perm-switch-wallet_balance").click();
      await page.waitForFunction(() => ((window as unknown as { __calls?: unknown[] }).__calls ?? []).length > 0);
      expect((await calls(page))[0]).toMatchObject({ name: "setAssistantPermission", input: { permission: "wallet_balance", granted: true } });
      expect(await page.locator("body").innerText()).toContain("does not let it pay for anything");
    } finally {
      await close();
    }
  });
});
