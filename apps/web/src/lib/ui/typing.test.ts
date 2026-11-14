import { afterEach, describe, expect, it, vi } from "vitest";
import { coarsePointer, DRAG_TO_DISMISS_PX, dismissKeyboard, dragDismissHandlers, enterSends } from "./typing";

const press = (over: Partial<{ key: string; shiftKey: boolean; composing: boolean }> = {}) => ({
  key: over.key ?? "Enter",
  shiftKey: over.shiftKey ?? false,
  nativeEvent: { isComposing: over.composing ?? false },
});

describe("Enter depends on what you are typing on", () => {
  it("sends on a computer, and makes a new line with Shift", () => {
    expect(enterSends(press(), false)).toBe(true);
    expect(enterSends(press({ shiftKey: true }), false)).toBe(false);
  });

  it("never sends on a phone: the Return key is how a second line is written", () => {
    /* The platform shipped the desk rule on every device, so a thumbed
       Return sent a half-written message (founder, 14 November 2026). */
    expect(enterSends(press(), true)).toBe(false);
  });

  it("never sends while an input method is composing", () => {
    /* A Chinese or Japanese keyboard uses Enter to choose a candidate. */
    expect(enterSends(press({ composing: true }), false)).toBe(false);
  });

  it("ignores every other key", () => {
    expect(enterSends(press({ key: "a" }), false)).toBe(false);
  });
});

describe("putting the keyboard away", () => {
  /* The unit environment has no DOM, and `dismissKeyboard` asks whether the
     focused thing is an element. A stand-in class is enough: the check is
     `instanceof HTMLElement`, not anything the real one does. */
  class FakeElement {
    matches: (selector: string) => boolean;
    blur: () => void;
    constructor(matches: (selector: string) => boolean, blur: () => void) {
      this.matches = matches;
      this.blur = blur;
    }
  }
  vi.stubGlobal("HTMLElement", FakeElement);

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("HTMLElement", FakeElement);
  });

  it("reads a coarse pointer, and says no where it cannot ask", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    expect(coarsePointer()).toBe(true);
    vi.stubGlobal("window", {
      matchMedia: () => {
        throw new Error("no");
      },
    });
    expect(coarsePointer()).toBe(false);
  });

  it("blurs a focused field and leaves anything else alone", () => {
    const blurred = vi.fn();
    const field = new FakeElement((sel: string) => sel.includes("input"), blurred);
    vi.stubGlobal("document", { activeElement: field });
    dismissKeyboard();
    expect(blurred).toHaveBeenCalledOnce();

    const notAField = vi.fn();
    vi.stubGlobal("document", { activeElement: new FakeElement(() => false, notAField) });
    dismissKeyboard();
    expect(notAField).not.toHaveBeenCalled();
  });

  it("puts it away on a downward drag, never on a small scroll or an upward one", () => {
    const blurred = vi.fn();
    vi.stubGlobal("document", { activeElement: new FakeElement(() => true, blurred) });

    const drag = dragDismissHandlers();
    drag.onTouchStart({ touches: [{ clientY: 300 }] });
    drag.onTouchMove({ touches: [{ clientY: 300 + DRAG_TO_DISMISS_PX - 5 }] });
    expect(blurred).not.toHaveBeenCalled();
    drag.onTouchMove({ touches: [{ clientY: 300 + DRAG_TO_DISMISS_PX + 5 }] });
    expect(blurred).toHaveBeenCalledOnce();

    const upward = vi.fn();
    vi.stubGlobal("document", { activeElement: new FakeElement(() => true, upward) });
    const up = dragDismissHandlers();
    up.onTouchStart({ touches: [{ clientY: 300 }] });
    up.onTouchMove({ touches: [{ clientY: 100 }] });
    expect(upward).not.toHaveBeenCalled();
  });
});
