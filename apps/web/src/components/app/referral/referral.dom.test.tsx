/**
 * The referral dashboard's two interactive pieces, mounted for real in
 * Chromium on the product's stylesheet, with axe run on each.
 *
 *   InviteLinkCard  copy, the share sheet's "More ways" answered by what
 *                   `shareOrCopy` actually did, and the QR code in place
 *   WithdrawFlow    the minimum refused before the provider is asked, the fee
 *                   drawn only from a prepared quote, a quote that does not add
 *                   up never drawn, and Confirm ending on "processing"
 *
 * Fixtures are structural: slot figures and a fixture bank, no real person.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BROWSER_TEST_TIMEOUT,
  closeBrowser,
  hasBrowser,
  mountInBrowser,
  warmBrowser,
} from "@/lib/testing/mount-in-browser";
import { axeViolations } from "@/components/ui/ported-test-css";
import { productCss } from "@/lib/testing/product-css";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = productCss("components/app/referral/rewards.css");

/* The clipboard and the share API, stubbed so the outcome is the test's to choose. */
const STUB_CLIPBOARD = `
  window.__copied = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text) => { if (window.__clipboardRefuses) throw new Error("no"); window.__copied.push(text); } },
  });
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
`;

const INVITE_ENTRY = `
  import { getDictionary } from "@vallo/i18n";
  import { InviteLinkCard } from "@/components/app/referral/InviteLinkCard";
  import { ToastHost } from "@/components/ui/ToastHost";
  import { mount } from "@/lib/testing/browser-root";
  const t = getDictionary("en");
  /* What a tap did is said by the one banner (Grade 1), drawn by the host the
     root layout mounts. */
  mount(
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 16 }}>
      <InviteLinkCard url="https://vallospaces.com/join/K7M2QX" code="K7M2QX" copy={t.experienceRewards.invite} dismissLabel={t.experienceUi.notNow} />
      <ToastHost />
    </div>,
  );
`;

function withdrawEntry(feeMinor: number, receiveOffset = 0): string {
  return `
    import { getDictionary } from "@vallo/i18n";
    import { WithdrawFlow } from "@/components/app/referral/WithdrawFlow";
    import { mount } from "@/lib/testing/browser-root";
    const t = getDictionary("en");
    window.__quoted = [];
    window.__confirmed = [];
    const actions = {
      async quote(amountMinor) {
        window.__quoted.push(amountMinor);
        return { ok: true, quote: { quoteId: "q-" + amountMinor, amountMinor, feeMinor: ${feeMinor}, receiveMinor: amountMinor - ${feeMinor} + ${receiveOffset}, destination: { bankName: "Slot Bank", accountLast4: "0001", accountName: "Slot" } } };
      },
      async confirm(id) { window.__confirmed.push(id); return { ok: true }; },
    };
    mount(
      <div style={{ maxWidth: 420, margin: "0 auto", padding: 16 }}>
        <WithdrawFlow
          availableMinor={420000}
          minimumMinor={100000}
          destination={{ bankName: "Slot Bank", accountLast4: "0001", accountName: "Slot" }}
          actions={actions}
          copy={t.experienceRewards.withdraw}
          money={{ minimum: "Minimum sentence {minimum}.", feeFirst: "Fee sentence.", paidFrom: "Paid-from sentence." }}
          locale="en"
          historyHref="/rewards/history"
          backHref="/rewards"
        />
      </div>,
    );
  `;
}

describe.skipIf(!hasBrowser && !process.env.CI)("the invite link card", () => {
  it("copies the link, says where a share fell back to the clipboard, draws the QR in place, and passes axe", async () => {
    const { page, close } = await mountInBrowser({ entry: INVITE_ENTRY, css: CSS, init: STUB_CLIPBOARD });
    try {
      await page.getByTestId("rewards-invite-copy").click();
      await page.waitForFunction(() => (window as unknown as { __copied: string[] }).__copied.length === 1);
      expect(await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied[0])).toBe(
        "https://vallospaces.com/join/K7M2QX",
      );

      /* No share API here, so "More ways" copies, and says exactly that. */
      await page.getByTestId("rewards-invite-share").click();
      await page.getByRole("button", { name: /More ways to share/ }).click();
      await page.waitForFunction(() => (document.querySelector('[data-testid="rewards-invite-status"]')?.textContent ?? "") !== "");
      expect(await page.getByTestId("rewards-invite-status").textContent()).toBe(
        "There is no share sheet on this device, so the link was copied instead.",
      );

      /* A refused clipboard is said, not hidden behind a success. */
      await page.evaluate(() => {
        (window as unknown as { __clipboardRefuses: boolean }).__clipboardRefuses = true;
        document.execCommand = () => false;
      });
      await page.getByTestId("rewards-invite-copy").click();
      await page.waitForFunction(() => /could not be copied/.test(document.querySelector('[data-testid="rewards-invite-status"]')?.textContent ?? ""));

      const toggle = page.getByTestId("rewards-invite-qr-toggle");
      expect(await toggle.getAttribute("aria-expanded")).toBe("false");
      expect(await page.getByRole("img", { name: "QR code for your invite link" }).count()).toBe(0);
      await toggle.click();
      expect(await toggle.getAttribute("aria-expanded")).toBe("true");
      expect(await page.getByRole("img", { name: "QR code for your invite link" }).count()).toBe(1);

      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });
});

describe.skipIf(!hasBrowser && !process.env.CI)("the withdraw flow", () => {
  it("refuses an amount under the minimum before asking the provider, and draws no fee", async () => {
    const { page, close } = await mountInBrowser({ entry: withdrawEntry(5000), css: CSS });
    try {
      await page.getByLabel("Amount to withdraw").fill("999");
      await page.getByTestId("withdraw-prepare").click();
      await page.getByText("The minimum withdrawal is ₦1,000.").first().waitFor();
      expect(await page.evaluate(() => (window as unknown as { __quoted: number[] }).__quoted)).toEqual([]);
      expect(await page.getByTestId("withdraw-fee").count()).toBe(0);
      expect(await page.getByText("Fee sentence.").count()).toBe(1);
      expect(await page.getByTestId("withdraw-minimum").textContent()).toBe("₦1,000");
      expect(await axeViolations(page)).toEqual([]);
    } finally {
      await close();
    }
  });

  it("shows the provider's fee and what arrives before Confirm, then ends on processing, never paid", async () => {
    const { page, close } = await mountInBrowser({ entry: withdrawEntry(5000), css: CSS });
    try {
      await page.getByLabel("Amount to withdraw").fill("2000");
      expect(await page.getByTestId("withdraw-confirm").count()).toBe(0);
      await page.getByTestId("withdraw-prepare").click();
      await page.getByTestId("withdraw-breakdown").waitFor();
      expect(await page.evaluate(() => (window as unknown as { __quoted: number[] }).__quoted)).toEqual([200000]);
      expect(await page.getByTestId("withdraw-amount").textContent()).toBe("₦2,000");
      expect(await page.getByTestId("withdraw-fee").textContent()).toBe("₦50");
      expect(await page.getByTestId("withdraw-receive").textContent()).toBe("₦1,950");
      expect(await page.evaluate(() => (window as unknown as { __confirmed: string[] }).__confirmed)).toEqual([]);
      expect(await axeViolations(page)).toEqual([]);

      await page.getByTestId("withdraw-confirm").click();
      await page.getByTestId("rewards-withdraw-done").waitFor();
      expect(await page.evaluate(() => (window as unknown as { __confirmed: string[] }).__confirmed)).toEqual(["q-200000"]);
      const done = (await page.getByTestId("rewards-withdraw-done").textContent()) ?? "";
      expect(done).toContain("processing");
      expect(done.toLowerCase()).not.toMatch(/successful|paid out|complete/);
    } finally {
      await close();
    }
  });

  it("never draws a total that does not add up", async () => {
    const { page, close } = await mountInBrowser({ entry: withdrawEntry(5000, 100), css: CSS });
    try {
      await page.getByLabel("Amount to withdraw").fill("2000");
      await page.getByTestId("withdraw-prepare").click();
      await page.getByText(/did not add up/).first().waitFor();
      expect(await page.getByTestId("withdraw-breakdown").count()).toBe(0);
      expect(await page.getByTestId("withdraw-confirm").count()).toBe(0);
    } finally {
      await close();
    }
  });
});
