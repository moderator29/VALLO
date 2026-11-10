import { beforeEach, describe, expect, it, vi } from "vitest";
import { bannerWithUndo, UNDO_FAILED } from "./undo-banner";
import { currentToast, dismissToast } from "./toast";

/** The one helper behind every Undo on the platform. */
describe("bannerWithUndo", () => {
  beforeEach(() => dismissToast());

  it("says the outcome with an Undo action", () => {
    bannerWithUndo("Muted.", { undo: async () => ({ ok: true }), undone: "Unmuted." });
    const item = currentToast();
    expect(item?.message).toBe("Muted.");
    expect(item?.tone).toBe("success");
    expect(item?.action?.label).toBe("Undo");
  });

  it("calls the real inverse once, says its own outcome and runs onUndone", async () => {
    const undo = vi.fn(async () => ({ ok: true as const }));
    const onUndone = vi.fn();
    bannerWithUndo("Saved.", { undo, undone: "Removed again.", onUndone });
    const run = currentToast()!.action!.run;
    run();
    run(); // a second press is ignored
    await vi.waitFor(() => expect(currentToast()?.message).toBe("Removed again."));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(onUndone).toHaveBeenCalledTimes(1);
    expect(currentToast()?.action).toBeUndefined();
  });

  it("says the server's sentence when the inverse is refused, and does not touch the screen", async () => {
    const onUndone = vi.fn();
    bannerWithUndo("Closed.", { undo: async () => ({ ok: false, error: "A colleague changed it." }), undone: "Reopened.", onUndone });
    currentToast()!.action!.run();
    await vi.waitFor(() => expect(currentToast()?.message).toBe("A colleague changed it."));
    expect(currentToast()?.tone).toBe("error");
    expect(onUndone).not.toHaveBeenCalled();
  });

  it("says a plain failure when the inverse throws", async () => {
    bannerWithUndo("Done.", { undo: async () => { throw new Error("boom"); }, undone: "Back." });
    currentToast()!.action!.run();
    await vi.waitFor(() => expect(currentToast()?.message).toBe(UNDO_FAILED));
  });
});
