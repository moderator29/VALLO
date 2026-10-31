import { afterEach, describe, expect, it, vi } from "vitest";
import { isOffline, setNativeConnected } from "./connectivity";

/* The unit project runs in node: the browser's two globals are stubbed. */
function browser(onLine: boolean) {
  const win = new EventTarget();
  vi.stubGlobal("window", win);
  const nav = { onLine };
  vi.stubGlobal("navigator", nav);
  return { win, nav };
}

afterEach(() => {
  setNativeConnected(null);
  vi.unstubAllGlobals();
});

describe("true connectivity (fast-start plan item 16)", () => {
  it("answers as navigator.onLine does when the native layer has no verdict", () => {
    const { nav } = browser(true);
    expect(isOffline()).toBe(false);
    nav.onLine = false;
    expect(isOffline()).toBe(true);
  });

  it("offline when the operating system says so, even if the browser says online (captive portal)", () => {
    browser(true);
    setNativeConnected(false);
    expect(isOffline()).toBe(true);
    setNativeConnected(true);
    expect(isOffline()).toBe(false);
  });

  it("a native 'connected' never overrides the browser being sure it is offline", () => {
    browser(false);
    setNativeConnected(true);
    expect(isOffline()).toBe(true);
  });

  it("fires the same online and offline events the browser does, once per change", () => {
    const { win } = browser(true);
    const seen: string[] = [];
    const on = () => seen.push("online");
    const off = () => seen.push("offline");
    win.addEventListener("online", on);
    win.addEventListener("offline", off);
    setNativeConnected(false);
    setNativeConnected(false);
    setNativeConnected(true);
    win.removeEventListener("online", on);
    win.removeEventListener("offline", off);
    expect(seen).toEqual(["offline", "online"]);
  });
});
