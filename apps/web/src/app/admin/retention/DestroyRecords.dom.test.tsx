/**
 * THE RETENTION DESK'S TYPED CONFIRMATION, in a real Chromium. Nothing is
 * destroyed by a click: the button stays shut until DESTROY is typed exactly,
 * and what is sent is the phrase and the count the person was shown.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { axeViolations } from "@/components/ui/ported-test-css";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const entry = `
  import { getDictionary } from "@vallo/i18n";
  import { DestroyRecords } from "@/app/admin/retention/DestroyRecords";
  import { mount } from "@/lib/testing/browser-root";
  import { ToastHost } from "@/components/ui/ToastHost";
  const c = getDictionary("en").adminCoverage.retention;
  mount(
    <div style={{ width: 360, padding: 16 }}>
      <ToastHost />
      <DestroyRecords expected={3} totals={{ bank: 4, payout: 1, wallet: 2 }} copy={c} cancel="Cancel" />
    </div>,
  );
`;

const OK = "async () => ({ ok: true, data: { redacted: 3 } })";

describe.skipIf(!hasBrowser && !process.env.CI)("destroying the money records past retention", () => {
  it("shows the totals first, opens the confirmation only on request, and passes axe", async () => {
    const { page, close } = await mountInBrowser({ entry, css: productCss(), actions: { destroyExpiredMoneyRecords: OK } });
    try {
      expect(await page.getByText("permanently removes").count()).toBe(1);
      expect(await page.getByRole("textbox").count()).toBe(0);
      await page.getByRole("button", { name: "Destroy 3" }).click();
      expect(await page.getByRole("textbox").count()).toBe(1);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("keeps the button shut for anything but the exact phrase", async () => {
    const { page, close } = await mountInBrowser({ entry, css: productCss(), actions: { destroyExpiredMoneyRecords: OK } });
    try {
      await page.getByRole("button", { name: "Destroy 3" }).click();
      const go = page.locator("form").getByRole("button", { name: "Destroy 3" });
      for (const typed of ["destroy", "Destroy", "DESTROY ", "DESTROY IT"]) {
        await page.getByRole("textbox").fill(typed);
        expect(await go.isDisabled(), typed).toBe(true);
      }
      expect(await page.evaluate(() => (window as unknown as { __calls?: unknown[][] }).__calls?.length ?? 0)).toBe(0);
    } finally {
      await close();
    }
  });

  it("sends the phrase and the shown count, then reports what was destroyed", async () => {
    const { page, close } = await mountInBrowser({ entry, css: productCss(), actions: { destroyExpiredMoneyRecords: OK } });
    try {
      await page.getByRole("button", { name: "Destroy 3" }).click();
      await page.getByRole("textbox").fill("DESTROY");
      await page.locator("form").getByRole("button", { name: "Destroy 3" }).click();
      await page.getByRole("status").waitFor();
      expect(await page.getByRole("status").innerText()).toContain("Records destroyed for 3");
      const calls = await page.evaluate(() => (window as unknown as { __calls: unknown[][] }).__calls);
      expect(calls.at(-1)).toEqual(["destroyExpiredMoneyRecords", { confirm: "DESTROY", expected: 3 }]);
    } finally {
      await close();
    }
  });

  it("says the list changed and never claims a destruction", async () => {
    const changed = 'async () => ({ ok: false, error: "The list changed while you were reading it. Nothing was destroyed. Review it again." })';
    const { page, close } = await mountInBrowser({ entry, css: productCss(), actions: { destroyExpiredMoneyRecords: changed } });
    try {
      await page.getByRole("button", { name: "Destroy 3" }).click();
      await page.getByRole("textbox").fill("DESTROY");
      await page.locator("form").getByRole("button", { name: "Destroy 3" }).click();
      await page.getByRole("alert").waitFor();
      expect(await page.getByRole("alert").innerText()).toContain("Nothing was destroyed");
      expect(await page.getByRole("status").count()).toBe(0);
    } finally {
      await close();
    }
  });
});
