/**
 * A REVIEWER ASKED FOR ONE MORE PHOTO: the person sees the reviewer's words,
 * takes a selfie holding their ID with the same camera, and sends it back.
 * Never part of the verification steps.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const MESSAGE = "We could not confirm your identity from the photos you sent. Please take a selfie holding the same ID next to your face.";

const ENTRY = `
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { RequestedPhotoPanel } from "@/components/verification/RequestedPhotoPanel";
  import { answerVerificationRequest } from "@/app/(app)/verification/actions";
  mount(
    <RequestedPhotoPanel
      copy={getDictionary("en").experienceAccount.kyc}
      requestId="11111111-2222-4333-8444-555555555555"
      message=${JSON.stringify(MESSAGE)}
      submit={answerVerificationRequest}
    />,
  );
`;

const INIT = `
  window.__uploads = [];
  Object.defineProperty(Object.prototype, "auth", {
    value: { getUser: async () => ({ data: { user: { id: "user-7" } } }) },
    configurable: true, writable: true,
  });
  Object.defineProperty(Object.prototype, "upload", {
    value: async (path) => { window.__uploads.push(path); return { error: null }; },
    configurable: true, writable: true,
  });
  Object.defineProperty(Object.prototype, "remove", { value: async () => ({ error: null }), configurable: true, writable: true });
`;

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0xff, 0xd9]);

describe.skipIf(!hasBrowser && !process.env.CI)("the requested photo", () => {
  it("shows the reviewer's words, takes the selfie with the ID, and sends it back", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY,
      init: INIT,
      actions: { answerVerificationRequest: `async () => ({ ok: true })` },
    });
    try {
      expect(await page.getByTestId("request-message").innerText()).toBe(MESSAGE);
      expect(await page.getByTestId("selfie-step").innerText()).toContain("Take a selfie holding your ID");
      expect(await page.getByTestId("request-send").isDisabled()).toBe(true);

      await page.getByTestId("selfie-file").setInputFiles({ name: "me-with-id.jpg", mimeType: "image/jpeg", buffer: JPEG });
      await page.getByText("Selfie saved").waitFor();
      await page.getByTestId("request-send").click();
      await page.getByTestId("request-sent").waitFor();

      const uploads = await page.evaluate(() => (window as unknown as { __uploads: string[] }).__uploads);
      expect(uploads[0]).toMatch(/^user-7\/kyc-request-[^/]+\/selfie-with-id-[^/]+\.jpg$/);
      const calls = await page.evaluate(() => (window as unknown as { __calls: unknown[][] }).__calls);
      expect(calls.find((c) => c[0] === "answerVerificationRequest")).toEqual([
        "answerVerificationRequest",
        { requestId: "11111111-2222-4333-8444-555555555555", path: uploads[0] },
      ]);
    } finally {
      await close();
    }
  });

  it("keeps the photo and says why when sending fails", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY,
      init: INIT,
      actions: { answerVerificationRequest: `async () => ({ ok: false, message: "This request is already answered. Thank you." })` },
    });
    try {
      await page.getByTestId("selfie-file").setInputFiles({ name: "me-with-id.jpg", mimeType: "image/jpeg", buffer: JPEG });
      await page.getByText("Selfie saved").waitFor();
      await page.getByTestId("request-send").click();
      await page.getByText("This request is already answered").waitFor();
      expect(await page.getByTestId("request-sent").count()).toBe(0);
    } finally {
      await close();
    }
  });
});
