import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * STORE-04: the native share sheet, haptics and camera capture. On the website
 * none of them loads anything and every caller falls back; inside the shell
 * each reaches its plugin by name.
 */
const seam = vi.hoisted(() => ({
  available: new Set<string>(),
  share: vi.fn(),
  impact: vi.fn(),
  notification: vi.fn(),
  getPhoto: vi.fn(),
}));

/* Capacitor's plugins are Proxies that THROW when a promise reads `.then` on
   them ("Haptics.then() is not implemented on ios"). The fakes behave the same
   way, so any helper that resolves a promise WITH a plugin fails here as it did
   on a phone (the Home screen crash of 6 November 2026). */
function likeCapacitor<T extends object>(name: string, plugin: T): T {
  return new Proxy(plugin, {
    get(target, key, receiver) {
      if (key === "then") throw new Error(`"${name}.then()" is not implemented on ios`);
      return Reflect.get(target, key, receiver);
    },
  });
}

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isPluginAvailable: (name: string) => seam.available.has(name),
    registerPlugin: (name: string) =>
      name === "Share"
        ? likeCapacitor(name, { share: seam.share })
        : name === "Haptics"
          ? likeCapacitor(name, { impact: seam.impact, notification: seam.notification })
          : likeCapacitor(name, { getPhoto: seam.getPhoto }),
  },
}));

import { canCapturePhoto, capturePhoto, nativeShare, photoFile } from "./device";

function inShell(native: boolean) {
  vi.stubGlobal("window", native ? { Capacitor: { isNativePlatform: () => true, getPlatform: () => "ios" } } : {});
}

beforeEach(() => {
  seam.available = new Set(["Share", "Haptics", "Camera"]);
  for (const fn of [seam.share, seam.impact, seam.notification, seam.getPhoto]) fn.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("on the website", () => {
  it("handles nothing and loads no plugin", async () => {
    inShell(false);
    expect(await nativeShare({ url: "https://www.vallospaces.com/listing/x" })).toBe("unhandled");
    expect(await canCapturePhoto()).toBe(false);
    expect(await capturePhoto()).toBeNull();
    expect(seam.share).not.toHaveBeenCalled();
  });
});

describe("inside the shell", () => {
  it("opens the system share sheet with the listing link", async () => {
    inShell(true);
    seam.share.mockResolvedValue({});
    expect(await nativeShare({ title: "A flat", url: "https://www.vallospaces.com/listing/x" })).toBe("shared");
    expect(seam.share).toHaveBeenCalledWith(expect.objectContaining({ url: "https://www.vallospaces.com/listing/x" }));
  });

  it("reads a closed sheet as cancelled, not as a failure", async () => {
    inShell(true);
    seam.share.mockRejectedValue(new Error("Share canceled"));
    expect(await nativeShare({ url: "u" })).toBe("cancelled");
  });

  it("falls back when the binary has no share plugin", async () => {
    inShell(true);
    seam.available.delete("Share");
    expect(await nativeShare({ url: "u" })).toBe("unhandled");
  });

  it("returns the camera's photograph as an image File", async () => {
    inShell(true);
    seam.getPhoto.mockResolvedValue({ base64String: Buffer.from("jpegbytes").toString("base64"), format: "jpeg" });
    const file = await capturePhoto();
    expect(file).not.toBeNull();
    expect(file!.type).toBe("image/jpeg");
    expect(file!.size).toBe("jpegbytes".length);
    expect(seam.getPhoto).toHaveBeenCalledWith(expect.objectContaining({ source: "CAMERA", resultType: "base64", saveToGallery: false }));
  });

  it("a cancelled camera is null", async () => {
    inShell(true);
    seam.getPhoto.mockRejectedValue(new Error("User cancelled photos app"));
    expect(await capturePhoto()).toBeNull();
  });
});

describe("photoFile", () => {
  it("names png as png and anything else as jpeg", () => {
    expect(photoFile(Buffer.from("x").toString("base64"), "png")!.type).toBe("image/png");
    expect(photoFile(Buffer.from("x").toString("base64"), undefined)!.type).toBe("image/jpeg");
    expect(photoFile(undefined, "png")).toBeNull();
  });
});
