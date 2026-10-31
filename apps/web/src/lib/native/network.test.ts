import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isOffline, setNativeConnected } from "../offline/connectivity";

beforeEach(() => {
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("navigator", { onLine: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  setNativeConnected(null);
  vi.resetModules();
  vi.doUnmock("@capacitor/network");
});

describe("the native connection check", () => {
  it("feeds the first status and every change into the shared verdict, and lets go on teardown", async () => {
    let listener: ((s: { connected: boolean }) => void) | undefined;
    const remove = vi.fn();
    vi.doMock("@capacitor/network", () => ({
      Network: {
        getStatus: async () => ({ connected: false }),
        addListener: async (_: string, fn: (s: { connected: boolean }) => void) => {
          listener = fn;
          return { remove };
        },
      },
    }));
    const { startNetworkStatus } = await import("./network");
    const stop = await startNetworkStatus();
    expect(isOffline()).toBe(true);
    listener?.({ connected: true });
    expect(isOffline()).toBe(false);
    stop();
    expect(remove).toHaveBeenCalled();
  });

  it("does nothing, and does not throw, where the plugin is not in the build", async () => {
    vi.doMock("@capacitor/network", () => {
      throw new Error("plugin not implemented");
    });
    const { startNetworkStatus } = await import("./network");
    const stop = await startNetworkStatus();
    expect(isOffline()).toBe(false);
    expect(() => stop()).not.toThrow();
  });
});
