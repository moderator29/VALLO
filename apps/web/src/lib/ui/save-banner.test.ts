import { afterEach, describe, expect, it } from "vitest";

import { currentToast, dismissToast } from "./toast";
import { SAVE_WORDS, saveDoneBanner } from "./save-banner";

afterEach(() => dismissToast());

describe("the save banner", () => {
  it("says Saved and where it is, with Undo", () => {
    saveDoneBanner({ saved: true, undo: async () => ({ ok: true }) });
    const shown = currentToast();
    expect(shown?.message).toBe("Saved. It is in Saved.");
    expect(shown?.action?.label).toBe("Undo");
  });

  it("a removal is undoable too, and a device save says so", () => {
    saveDoneBanner({ saved: false, undo: async () => ({ ok: true }) });
    expect(currentToast()?.message).toBe(SAVE_WORDS.removed);
    saveDoneBanner({ saved: true, device: true, undo: async () => ({ ok: true }) });
    expect(currentToast()?.message).toBe(SAVE_WORDS.savedDevice);
  });

  it("Undo runs the real inverse, once, and says it", async () => {
    let calls = 0;
    let undone = 0;
    saveDoneBanner({ saved: true, undo: async () => (calls++, { ok: true }), onUndone: () => undone++ });
    const action = currentToast()?.action;
    action?.run();
    action?.run();
    await new Promise((r) => setTimeout(r, 5));
    expect(calls).toBe(1);
    expect(undone).toBe(1);
    expect(currentToast()?.message).toBe(SAVE_WORDS.undoneSave);
  });

  it("a failed inverse says why in the banner", async () => {
    saveDoneBanner({ saved: true, undo: async () => ({ ok: false, error: "Nope." }) });
    currentToast()?.action?.run();
    await new Promise((r) => setTimeout(r, 5));
    expect(currentToast()?.message).toBe("Nope.");
  });
});
