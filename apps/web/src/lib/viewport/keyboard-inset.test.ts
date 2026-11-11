import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KEYBOARD_FLOOR_PX, keyboardInsetFrom, startKeyboardInset } from "./keyboard-inset";

/*
 * THE BROWSER'S HALF OF THE KEYBOARD CONTRACT (the founder, 11 November 2026:
 * the composer sits too low with the keyboard up, on his iPhone).
 *
 * The rules pinned here are the ones the composer's padding hangs off:
 *   open      a visual viewport shorter than the layout viewport, while
 *             something editable has focus, marks the root and carries the
 *             measured height
 *   not open  nothing focused; an address bar's worth of difference; and,
 *             above all, inside the shell, where the plugin owns both values
 *             and a second writer would clear what it had just set
 */

describe("keyboardInsetFrom: what counts as a keyboard", () => {
  const base = { layoutHeight: 844, visualHeight: 844, offsetTop: 0, editableFocused: true };

  it("is the height the viewport lost", () => {
    expect(keyboardInsetFrom({ ...base, visualHeight: 508 })).toBe(336);
  });

  it("counts the visual viewport's own offset, so a scrolled-up page is not a keyboard", () => {
    expect(keyboardInsetFrom({ ...base, visualHeight: 508, offsetTop: 336 })).toBe(0);
  });

  it("is nothing with no editable field focused, however short the viewport", () => {
    expect(keyboardInsetFrom({ ...base, visualHeight: 400, editableFocused: false })).toBe(0);
  });

  it("is nothing below the floor: an address bar sliding away is not a keyboard", () => {
    expect(keyboardInsetFrom({ ...base, visualHeight: 844 - (KEYBOARD_FLOOR_PX - 1) })).toBe(0);
    expect(keyboardInsetFrom({ ...base, visualHeight: 844 - KEYBOARD_FLOOR_PX })).toBe(KEYBOARD_FLOOR_PX);
  });

  it("is nothing when the viewport grew, which no keyboard does", () => {
    expect(keyboardInsetFrom({ ...base, visualHeight: 900 })).toBe(0);
  });

  it("is nothing while the page is pinched: a magnified page is not a keyboard", () => {
    expect(keyboardInsetFrom({ ...base, visualHeight: 300, scale: 3 })).toBe(0);
    /* A hair over 1 is the browser rounding its own scale, not a pinch. */
    expect(keyboardInsetFrom({ ...base, visualHeight: 508, scale: 1.01 })).toBe(336);
  });
});

describe("startKeyboardInset: the root while the keys are up", () => {
  const style = new Map<string, string>();
  const dataset: Record<string, string | undefined> = {};
  const attributes = new Set<string>();
  const viewportListeners = new Map<string, () => void>();
  const windowListeners = new Map<string, () => void>();
  let active: { matches: (s: string) => boolean } | null = null;
  const viewport = { height: 844, offsetTop: 0 };

  beforeEach(() => {
    style.clear();
    attributes.clear();
    viewportListeners.clear();
    windowListeners.clear();
    for (const key of Object.keys(dataset)) delete dataset[key];
    active = null;
    viewport.height = 844;
    viewport.offsetTop = 0;
    class FakeElement {
      matches(_selector: string) {
        return true;
      }
    }
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("document", {
      documentElement: {
        style: { setProperty: (k: string, v: string) => style.set(k, v) },
        dataset,
        hasAttribute: (name: string) => attributes.has(name),
      },
      get activeElement() {
        return active;
      },
    });
    vi.stubGlobal("window", {
      innerHeight: 844,
      visualViewport: {
        height: 0,
        offsetTop: 0,
        scale: 1,
        addEventListener: (name: string, fn: () => void) => viewportListeners.set(name, fn),
        removeEventListener: (name: string) => viewportListeners.delete(name),
      },
      addEventListener: (name: string, fn: () => void) => windowListeners.set(name, fn),
      removeEventListener: (name: string) => windowListeners.delete(name),
    });
    /* The viewport object the module reads is the one on window; keep the two
       numbers in step through the shared record above. */
    Object.defineProperty(window.visualViewport!, "height", { get: () => viewport.height });
    Object.defineProperty(window.visualViewport!, "offsetTop", { get: () => viewport.offsetTop });
  });
  afterEach(() => vi.unstubAllGlobals());

  const focusField = () => {
    active = new (globalThis as unknown as { HTMLElement: new () => { matches: (s: string) => boolean } }).HTMLElement();
  };

  it("marks the root with the measured height when the keys arrive", () => {
    startKeyboardInset();
    focusField();
    viewport.height = 508;
    viewportListeners.get("resize")!();
    expect(style.get("--nf-keyboard-inset")).toBe("336px");
    expect(dataset.keyboard).toBe("open");
  });

  it("clears the mark when the keys go", () => {
    startKeyboardInset();
    focusField();
    viewport.height = 508;
    viewportListeners.get("resize")!();
    active = null;
    viewport.height = 844;
    viewportListeners.get("resize")!();
    expect(style.get("--nf-keyboard-inset")).toBe("0px");
    expect(dataset.keyboard).toBeUndefined();
  });

  it("stands down inside the shell, where the plugin owns both values", () => {
    attributes.add("data-native");
    const stop = startKeyboardInset();
    expect(viewportListeners.size).toBe(0);
    expect(windowListeners.size).toBe(0);
    stop();
    expect(dataset.keyboard).toBeUndefined();
  });

  it("a teardown removes every listener and leaves no mark behind", () => {
    const stop = startKeyboardInset();
    focusField();
    viewport.height = 508;
    viewportListeners.get("resize")!();
    expect(dataset.keyboard).toBe("open");
    stop();
    expect(viewportListeners.size).toBe(0);
    expect(windowListeners.size).toBe(0);
    expect(dataset.keyboard).toBeUndefined();
    expect(style.get("--nf-keyboard-inset")).toBe("0px");
  });
});
