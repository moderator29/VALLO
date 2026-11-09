import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deviceKeyState, forgetDeviceKey, noteDeviceKeyFailed, rememberDeviceKey } from "./device-keys";

describe("which Face ID keys this phone holds", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("a phone with no record is unknown, and still offered the unlock", () => {
    expect(deviceKeyState()).toBe("unknown");
  });

  it("two failed tries with no success mean this phone has no key; one does not", () => {
    expect(noteDeviceKeyFailed()).toBe("unknown");
    expect(noteDeviceKeyFailed()).toBe("none");
    expect(deviceKeyState(["k1"])).toBe("none");
  });

  it("a key made or used here is this phone's; a key made elsewhere is not", () => {
    rememberDeviceKey("k1");
    expect(deviceKeyState()).toBe("has");
    expect(deviceKeyState(["k1", "k2"])).toBe("has");
    expect(deviceKeyState(["k2"])).toBe("none");
  });

  it("a cancelled ceremony never takes away a key this phone holds", () => {
    rememberDeviceKey("k1");
    expect(noteDeviceKeyFailed()).toBe("has");
    expect(deviceKeyState(["k1"])).toBe("has");
  });

  it("success after failures clears them, and a removed key is forgotten", () => {
    noteDeviceKeyFailed();
    rememberDeviceKey("k1");
    expect(deviceKeyState()).toBe("has");
    forgetDeviceKey("k1");
    expect(deviceKeyState(["k1"])).toBe("unknown");
  });

  it("a refused storage reads as unknown and never throws", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } } });
    expect(deviceKeyState()).toBe("unknown");
    expect(() => rememberDeviceKey("k1")).not.toThrow();
  });
});
