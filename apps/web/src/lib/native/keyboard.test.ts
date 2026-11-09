import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* The plugin, replaced by one that remembers its listeners. */
const listeners = new Map<string, (info: { keyboardHeight: number }) => void>();
const removed: string[] = [];
vi.mock("@capacitor/keyboard", () => ({
  Keyboard: {
    addListener: async (name: string, fn: (info: { keyboardHeight: number }) => void) => {
      listeners.set(name, fn);
      return { remove: async () => void removed.push(name) };
    },
  },
}));

describe("the keyboard foot (N3): --nf-keyboard-inset and data-keyboard", () => {
  const style = new Map<string, string>();
  const dataset: Record<string, string | undefined> = {};
  beforeEach(() => {
    listeners.clear();
    removed.length = 0;
    style.clear();
    for (const k of Object.keys(dataset)) delete dataset[k];
    vi.stubGlobal("document", {
      documentElement: { style: { setProperty: (k: string, v: string) => style.set(k, v) }, dataset },
      activeElement: null,
    });
    vi.stubGlobal("window", { requestAnimationFrame: (f: () => void) => f(), matchMedia: () => ({ matches: false }) });
    vi.stubGlobal("HTMLElement", class {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it("rides on the keys: the inset is the keyboard's height, rounded, and the root says open", async () => {
    const { startKeyboard } = await import("./keyboard");
    await startKeyboard();
    listeners.get("keyboardWillShow")!({ keyboardHeight: 301.6 });
    expect(style.get("--nf-keyboard-inset")).toBe("302px");
    expect(dataset.keyboard).toBe("open");
  });

  it("the last event is the true one: a Did show after a Will hide is closed again by Did hide", async () => {
    const { startKeyboard } = await import("./keyboard");
    await startKeyboard();
    listeners.get("keyboardWillHide")!({ keyboardHeight: 0 });
    listeners.get("keyboardDidShow")!({ keyboardHeight: 280 });
    listeners.get("keyboardDidHide")!({ keyboardHeight: 0 });
    expect(style.get("--nf-keyboard-inset")).toBe("0px");
    expect(dataset.keyboard).toBeUndefined();
  });

  it("a teardown removes all four listeners and never leaves the dock hidden", async () => {
    const { startKeyboard } = await import("./keyboard");
    const stop = await startKeyboard();
    listeners.get("keyboardWillShow")!({ keyboardHeight: 300 });
    stop();
    expect(removed.sort()).toEqual(["keyboardDidHide", "keyboardDidShow", "keyboardWillHide", "keyboardWillShow"]);
    expect(dataset.keyboard).toBeUndefined();
  });
});
