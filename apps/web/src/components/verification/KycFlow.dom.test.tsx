/**
 * THE MANUAL VERIFICATION FLOW, END TO END in Chromium: the ID, the live
 * selfie, the proof of address, the business question, the three agreements,
 * the review, and the submission the server receives, then the "what happens
 * next" screen with the bank account step for a lister.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());

const ENTRY = `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { KycFlow } from "@/components/verification/KycFlow";
  import { submitVerification } from "@/app/(app)/verification/actions";
  mount(
    <KycFlow
      submit={submitVerification}
      copy={getDictionary("en").experienceAccount.kyc}
      payoutHref="/agent/earnings"
    />,
  );
`;

const INIT = `
  window.__uploads = [];
  Object.defineProperty(Object.prototype, "auth", {
    value: { getUser: async () => ({ data: { user: { id: "user-9" } } }), getSession: async () => ({ data: { session: { access_token: "t" } } }) },
    configurable: true, writable: true,
  });
  Object.defineProperty(Object.prototype, "upload", {
    value: async (path) => { window.__uploads.push(path); return { error: null }; },
    configurable: true, writable: true,
  });
  Object.defineProperty(Object.prototype, "remove", { value: async () => ({ error: null }), configurable: true, writable: true });
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640; canvas.height = 480;
    const ctx = canvas.getContext("2d");
    setInterval(() => { ctx.fillStyle = "peru"; ctx.fillRect(0, 0, 640, 480); }, 30);
    return canvas.captureStream(15);
  };
`;

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0xff, 0xd9]);

describe.skipIf(!hasBrowser && !process.env.CI)("the verification flow, end to end", () => {
  it("walks ID, selfie, address, agreements and review, and sends all three documents", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY,
      init: INIT,
      actions: { submitVerification: `async () => ({ ok: true })` },
    });
    try {
      /* 1. The ID. */
      await page.getByText("Step 1 of 6").waitFor();
      await page.locator('input[type="file"]').first().setInputFiles({ name: "passport.jpg", mimeType: "image/jpeg", buffer: JPEG });
      await page.getByLabel("Which ID is this?").selectOption("passport");
      await page.getByRole("button", { name: "Continue" }).click();

      /* 2. The selfie: live, no ID in hand. */
      await page.getByText("Step 2 of 6").waitFor();
      expect(await page.getByRole("button", { name: "Continue" }).isDisabled()).toBe(true);
      await page.getByTestId("selfie-start").click();
      await page.getByTestId("selfie-capture").waitFor();
      await page.waitForFunction(() => ((document.querySelector("video") as HTMLVideoElement | null)?.videoWidth ?? 0) > 0);
      await page.getByTestId("selfie-capture").click();
      await page.getByTestId("selfie-use").click();
      await page.getByText("Selfie saved").waitFor();
      await page.getByRole("button", { name: "Continue" }).click();

      /* 3. The address. */
      await page.getByText("Step 3 of 6").waitFor();
      await page.locator('input[type="file"]').first().setInputFiles({ name: "bill.jpg", mimeType: "image/jpeg", buffer: JPEG });
      await page.getByLabel("Which document is this?").selectOption("utility_bill");
      await page.getByLabel("Date on the document").fill(today);
      await page.getByRole("button", { name: "Continue" }).click();

      /* 4. Not a business. */
      await page.getByText("Step 4 of 6").waitFor();
      await page.getByRole("button", { name: /No, this is just me/ }).click();

      /* 5. The three agreements. */
      await page.getByText("Step 5 of 6").waitFor();
      for (const box of await page.locator('input[type="checkbox"]').all()) await box.check();
      await page.getByRole("button", { name: "Continue" }).click();

      /* 6. Review and send. */
      await page.getByText("Step 6 of 6").waitFor();
      const review = await page.locator("ul").first().innerText();
      expect(review).toContain("Selfie");
      expect(review).toContain("Taken");
      await page.getByRole("button", { name: "Send for review" }).click();

      /* What happens next, with the bank account step. */
      await page.getByTestId("kyc-next-steps").waitFor();
      expect(await page.getByTestId("kyc-next-payout").getAttribute("href")).toBe("/agent/earnings");

      const calls = await page.evaluate(() => (window as unknown as { __calls: unknown[][] }).__calls);
      const sent = calls.find((c) => c[0] === "submitVerification")![1] as {
        documents: { identity: { path: string; subtype: string }; address: { path: string; subtype: string; issuedOn: string } };
        selfie: { path: string };
        consents: string[];
        business: boolean;
      };
      expect(sent.documents.identity.subtype).toBe("passport");
      expect(sent.documents.identity.path).toMatch(/^user-9\/kyc-[^/]+\/identity-/);
      expect(sent.selfie.path).toMatch(/^user-9\/kyc-[^/]+\/selfie-[^/]+\.jpg$/);
      expect(sent.documents.address).toMatchObject({ subtype: "utility_bill", issuedOn: today });
      expect(sent.consents.sort()).toEqual(["accuracy", "processing", "terms"]);
      expect(sent.business).toBe(false);
    } finally {
      await close();
    }
  });

  it("will not move past the selfie step without a selfie", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, init: INIT });
    try {
      await page.route("**/storage/v1/object/**", (route) => route.fulfill({ status: 200, body: "{}" }));
      await page.locator('input[type="file"]').first().setInputFiles({ name: "passport.jpg", mimeType: "image/jpeg", buffer: JPEG });
      await page.getByLabel("Which ID is this?").selectOption("passport");
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByText("Step 2 of 6").waitFor();
      expect(await page.getByRole("button", { name: "Continue" }).isDisabled()).toBe(true);
    } finally {
      await close();
    }
  });
});
