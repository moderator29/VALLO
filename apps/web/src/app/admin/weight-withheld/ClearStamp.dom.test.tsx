/**
 * THE WITHHELD-WEIGHT DESK'S CLEAR CONTROL, in a real Chromium: it stays shut
 * until asked, says what clearing does, will not send a note under twelve
 * characters, sends exactly the record and the note, and puts a refusal in
 * words without pretending it cleared.
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
  import { ClearStamp } from "@/app/admin/weight-withheld/ClearStamp";
  import { mount } from "@/lib/testing/browser-root";
  import { ToastHost } from "@/components/ui/ToastHost";
  const c = getDictionary("en").adminCoverage.weightWithheld;
  mount(
    <div style={{ width: 360, padding: 16 }}>
      <ToastHost />
      <ul className="nf-rows nf-group">
        <li className="nf-row flex-wrap items-start">
          <span className="min-w-[12rem] flex-1 basis-0">A stamped review</span>
          <ClearStamp kind="review" subject="7c1e9a52-3b84-4d6f-9a21-5e0d8f4b6c13" copy={{ ...c, cancel: "Cancel" }} />
        </li>
      </ul>
    </div>,
  );
`;

const OK = "async () => ({ ok: true, data: null })";
const NOTE = "Two different people, I saw both IDs.";

describe.skipIf(!hasBrowser && !process.env.CI)("clearing a withheld-weight stamp", () => {
  it("opens only on request, says what it does, and passes axe", async () => {
    const { page, close } = await mountInBrowser({ entry, css: productCss(), actions: { clearWeightWithheld: OK } });
    try {
      expect(await page.getByRole("textbox").count()).toBe(0);
      await page.getByRole("button", { name: "Clear this stamp" }).click();
      expect(await page.getByText("It will count again in public lists").count()).toBe(1);
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("will not send a short note, then sends the record and the note and says it cleared", async () => {
    const { page, close } = await mountInBrowser({ entry, css: productCss(), actions: { clearWeightWithheld: OK } });
    try {
      await page.getByRole("button", { name: "Clear this stamp" }).click();
      const confirm = page.getByRole("button", { name: "Clear the stamp" });
      await page.getByRole("textbox").fill("short");
      expect(await confirm.isDisabled()).toBe(true);
      await page.getByRole("textbox").fill(NOTE);
      await confirm.click();
      await page.getByRole("status").waitFor();
      expect(await page.getByRole("status").innerText()).toContain("Cleared");
      const calls = await page.evaluate(() => (window as unknown as { __calls: unknown[][] }).__calls);
      expect(calls.at(-1)).toEqual(["clearWeightWithheld", { kind: "review", subject: "7c1e9a52-3b84-4d6f-9a21-5e0d8f4b6c13", note: NOTE }]);
    } finally {
      await close();
    }
  });

  it("says why when the database refuses, and does not claim it cleared", async () => {
    const refused = 'async () => ({ ok: false, error: "That stamp is already gone. Refresh to see the current list." })';
    const { page, close } = await mountInBrowser({ entry, css: productCss(), actions: { clearWeightWithheld: refused } });
    try {
      await page.getByRole("button", { name: "Clear this stamp" }).click();
      await page.getByRole("textbox").fill(NOTE);
      await page.getByRole("button", { name: "Clear the stamp" }).click();
      await page.getByRole("alert").waitFor();
      expect(await page.getByRole("alert").innerText()).toContain("already gone");
      expect(await page.getByRole("status").count()).toBe(0);
    } finally {
      await close();
    }
  });
});
