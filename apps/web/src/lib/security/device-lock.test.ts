import { describe, expect, it } from "vitest";
import { classifyDeviceLock } from "./device-lock";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";

describe("classifyDeviceLock", () => {
  it("names Face ID on a modern iPhone and Touch ID on a home-button iPhone", () => {
    expect(classifyDeviceLock({ userAgent: IPHONE, screenWidth: 390, screenHeight: 844 })).toBe("face-id");
    expect(classifyDeviceLock({ userAgent: IPHONE, screenWidth: 375, screenHeight: 667 })).toBe("touch-id");
    expect(classifyDeviceLock({ userAgent: IPHONE, screenWidth: 736, screenHeight: 414 })).toBe("touch-id");
  });
  it("never claims a method it cannot know on iPad and Mac", () => {
    expect(classifyDeviceLock({ userAgent: MAC, maxTouchPoints: 5 })).toBe("this-device");
    expect(classifyDeviceLock({ userAgent: MAC, maxTouchPoints: 0 })).toBe("this-device");
    expect(classifyDeviceLock({ userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)" })).toBe("this-device");
  });
  it("uses fingerprint on Android and Windows Hello on Windows", () => {
    expect(classifyDeviceLock({ userAgent: ANDROID })).toBe("fingerprint");
    expect(classifyDeviceLock({ userAgent: WINDOWS, platform: "Win32" })).toBe("windows-hello");
  });
  it("falls back to the device itself", () => {
    expect(classifyDeviceLock({ userAgent: "Mozilla/5.0 (X11; Linux x86_64)" })).toBe("this-device");
  });
});
