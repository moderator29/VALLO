/**
 * THE SELFIE STEP, in Chromium: the live front camera with an oval guide,
 * a photo taken and saved into the person's own folder, and the phone's own
 * camera as the way in when the browser will not give one. Nobody is asked to
 * hold their ID up.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, mountInBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const ENTRY = `
  import { useState } from "react";
  import { getDictionary } from "@vallo/i18n";
  import { mount } from "@/lib/testing/browser-root";
  import { SelfieCapture } from "@/components/verification/SelfieCapture";
  function Harness() {
    const [selfie, setSelfie] = useState(null);
    return (
      <SelfieCapture
        copy={getDictionary("en").experienceAccount.kyc}
        batchId="batch-1"
        selfie={selfie}
        onChange={(next) => { window.__selfie = next; setSelfie(next); }}
      />
    );
  }
  mount(<Harness />);
`;

/** A camera that is a painted canvas: a real MediaStream with a video track. */
const FAKE_CAMERA = `
  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    window.__constraints = constraints;
    const canvas = document.createElement("canvas");
    canvas.width = 640; canvas.height = 480;
    const ctx = canvas.getContext("2d");
    setInterval(() => { ctx.fillStyle = "peru"; ctx.fillRect(0, 0, 640, 480); ctx.fillStyle = "black"; ctx.fillRect(280, 180, 80, 40); }, 30);
    return canvas.captureStream(15);
  };
`;

const STORAGE = `
  window.__uploads = [];
  Object.defineProperty(Object.prototype, "auth", {
    value: { getUser: async () => ({ data: { user: { id: "user-123" } } }) },
    configurable: true, writable: true,
  });
  Object.defineProperty(Object.prototype, "upload", {
    value: async (path, body, options) => { window.__uploads.push({ path, type: options.contentType, size: body.size }); return { error: null }; },
    configurable: true, writable: true,
  });
  Object.defineProperty(Object.prototype, "remove", { value: async () => ({ error: null }), configurable: true, writable: true });
`;

describe.skipIf(!hasBrowser && !process.env.CI)("the selfie step", () => {
  it("opens the front camera with an oval guide, takes the photo and saves it under the person's own folder", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, init: FAKE_CAMERA + STORAGE });
    try {
      const text = await page.getByTestId("selfie-step").innerText();
      expect(text).toContain("Look straight at the camera");
      expect(text.toLowerCase()).not.toContain("hold your id");

      await page.getByTestId("selfie-start").click();
      await page.getByTestId("selfie-capture").waitFor();
      const constraints = await page.evaluate(() => (window as unknown as { __constraints: { video: { facingMode: string } } }).__constraints);
      expect(constraints.video.facingMode).toBe("user");
      await page.waitForFunction(() => (document.querySelector("video") as HTMLVideoElement | null)?.videoWidth ?? 0 > 0);

      await page.getByTestId("selfie-capture").click();
      await page.getByTestId("selfie-use").waitFor();
      await page.getByTestId("selfie-use").click();

      await page.getByText("Selfie saved").waitFor();
      const uploads = await page.evaluate(() => (window as unknown as { __uploads: { path: string; type: string; size: number }[] }).__uploads);
      expect(uploads).toHaveLength(1);
      expect(uploads[0]!.path).toMatch(/^user-123\/kyc-batch-1\/selfie-[^/]+\.jpg$/);
      expect(uploads[0]!.type).toBe("image/jpeg");
      expect(uploads[0]!.size).toBeGreaterThan(0);
      const selfie = await page.evaluate(() => (window as unknown as { __selfie: { path: string } }).__selfie);
      expect(selfie.path).toBe(uploads[0]!.path);
      /* The camera is let go once the photo is taken. */
      expect(await page.locator("video").count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("says plainly when the camera is blocked, and offers the phone's own camera", async () => {
    const { page, close } = await mountInBrowser({
      entry: ENTRY,
      init: `
        navigator.mediaDevices = navigator.mediaDevices || {};
        navigator.mediaDevices.getUserMedia = async () => { const e = new Error("denied"); e.name = "NotAllowedError"; throw e; };
      `,
    });
    try {
      await page.getByTestId("selfie-start").click();
      await page.getByText("The camera is blocked for Vallo").waitFor();
      expect(await page.getByTestId("selfie-from-camera").isVisible()).toBe(true);
      expect(await page.getByTestId("selfie-file").getAttribute("capture")).toBe("user");
      expect(await page.getByTestId("selfie-file").getAttribute("accept")).toBe("image/*");
    } finally {
      await close();
    }
  });

  it("takes a photo from the phone's own camera when that is the way in", async () => {
    const { page, close } = await mountInBrowser({ entry: ENTRY, init: STORAGE });
    try {
      await page.getByTestId("selfie-file").setInputFiles({
        name: "face.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0xff, 0xd9]),
      });
      await page.getByText("Selfie saved").waitFor();
      const uploads = await page.evaluate(() => (window as unknown as { __uploads: { path: string }[] }).__uploads);
      expect(uploads[0]!.path).toMatch(/^user-123\/kyc-batch-1\/selfie-[^/]+\.jpg$/);
    } finally {
      await close();
    }
  });
});
