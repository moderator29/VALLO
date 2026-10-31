// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { isOffline, setNativeConnected } from "./connectivity";

afterEach(() => {
  setNativeConnected(null);
  vi.restoreAllMocks();
});

describe("true connectivity (fast-start plan item 16)", () => {
  it("answers as navigator.onLine does when the native layer has no verdict", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    expect(isOffline()).toBe(false);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(isOffline()).toBe(true);
  });

  it("offline when the operating system says so, even if the browser says online (captive portal)", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    setNativeConnected(false);
    expect(isOffline()).toBe(true);
    setNativeConnected(true);
    expect(isOffline()).toBe(false);
  });

  it("a native 'connected' never overrides the browser being sure it is offline", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    setNativeConnected(true);
    expect(isOffline()).toBe(true);
  });

  it("fires the same online and offline events the browser does, once per change", () => {
    const seen: string[] = [];
    const on = () => seen.push("online");
    const off = () => seen.push("offline");
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setNativeConnected(false);
    setNativeConnected(false);
    setNativeConnected(true);
    window.removeEventListener("online", on);
    window.removeEventListener("offline", off);
    expect(seen).toEqual(["offline", "online"]);
  });
});
