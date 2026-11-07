import { afterEach, describe, expect, it, vi } from "vitest";
import { banner, currentToast, dismissToast, dwellFor, ERROR_HOLD_MS, subscribeToast, swipeDismisses, toast } from "./toast";

describe("the one toast", () => {
  it("shows the newest message and replaces the last", () => {
    const seen: (string | null)[] = [];
    const off = subscribeToast((item) => seen.push(item?.message ?? null));
    toast("Link copied");
    toast.success("Saved");
    expect(currentToast()?.message).toBe("Saved");
    expect(currentToast()?.tone).toBe("success");
    dismissToast();
    expect(currentToast()).toBeNull();
    off();
    expect(seen).toEqual(["Link copied", "Saved", null]);
  });

  it("dismisses by id only while that message is up", () => {
    const first = toast("One");
    toast("Two");
    dismissToast(first);
    expect(currentToast()?.message).toBe("Two");
    dismissToast();
  });

  it("gives errors and undo offers the longer dwell", () => {
    expect(dwellFor("neutral", false)).toBe(3200);
    expect(dwellFor("warning", false)).toBe(6000);
    expect(dwellFor("error", false)).toBe(6000);
    expect(dwellFor("success", true)).toBe(6000);
    const id = toast.error("Could not copy");
    expect(currentToast()?.durationMs).toBe(6000);
    dismissToast(id);
  });

  it("swipes away far enough or fast enough, and springs back otherwise", () => {
    expect(swipeDismisses(80, 0.1)).toBe(true);
    expect(swipeDismisses(-80, -0.1)).toBe(true);
    expect(swipeDismisses(20, 0.6)).toBe(true);
    expect(swipeDismisses(30, 0.1)).toBe(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    dismissToast();
    dismissToast();
  });

  it("is the Grade 1 banner: four tones, one store", () => {
    expect(banner).toBe(toast);
    banner.info("Saved on your device");
    expect(currentToast()?.tone).toBe("info");
    banner.warning("Your session ends soon");
    expect(currentToast()?.tone).toBe("warning");
    expect(currentToast()?.durationMs).toBe(6000);
  });

  it("turns a retry into a Try again action with the long dwell", () => {
    const retry = vi.fn();
    banner.error("Message couldn't be sent. Check your connection and try again.", { retry });
    const item = currentToast();
    expect(item?.action?.label).toBe("Try again");
    item?.action?.run();
    expect(retry).toHaveBeenCalledOnce();
    expect(item?.durationMs).toBe(6000);
  });

  it("restarts the clock for the same words instead of a second banner", () => {
    const first = banner.success("Saved to your list");
    const second = banner.success("Saved to your list");
    expect(second).not.toBe(first);
    expect(currentToast()?.message).toBe("Saved to your list");
  });

  it("holds an error before a calmer message replaces it, then shows the newest", () => {
    vi.useFakeTimers();
    banner.error("Payment failed");
    banner.success("Saved");
    banner.info("Newest wins");
    expect(currentToast()?.message).toBe("Payment failed");
    vi.advanceTimersByTime(ERROR_HOLD_MS + 10);
    expect(currentToast()?.message).toBe("Newest wins");
  });

  it("lets a closed error hand over to the message waiting behind it", () => {
    vi.useFakeTimers();
    banner.error("Could not save");
    banner.success("Saved");
    dismissToast();
    expect(currentToast()?.message).toBe("Saved");
  });

  it("lets an error replace anything at once", () => {
    banner.success("Saved");
    banner.error("Could not save");
    expect(currentToast()?.tone).toBe("error");
  });
});
