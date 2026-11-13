import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BANNER_CARRY_MS,
  BANNER_TIMING,
  banner,
  currentToast,
  dismissToast,
  dwellFor,
  ERROR_HOLD_MS,
  noteRouteChange,
  subscribeToast,
  swipeDismisses,
  toast,
  updateToast,
} from "./toast";

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
    /* The SAME id now (Agent FEEL, 13 November 2026). The host keys the card
       on the id, so the new id this used to mint remounted the card and ran
       its entrance a second time: the very "second slide-in" this rule exists
       to prevent. The clock restart is carried by `shownAt` instead, which the
       host watches; one banner, one entrance, a fresh dwell. */
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const first = banner.success("Saved to your list");
    const firstShown = currentToast()?.shownAt;
    vi.setSystemTime(2_500);
    const second = banner.success("Saved to your list");
    expect(second).toBe(first);
    expect(currentToast()?.message).toBe("Saved to your list");
    expect(currentToast()?.shownAt).toBe(2_500);
    expect(currentToast()?.shownAt).not.toBe(firstShown);
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

  /* THE ONE TIMING CONTRACT (Agent FEEL, 13 November 2026). */
  it("names one contract: raised on the tap, 3.2s, 6s with an action, tokens in and out", () => {
    expect(BANNER_TIMING.raise).toBe("on-tap");
    expect(BANNER_TIMING.dwellMs).toBe(3200);
    expect(BANNER_TIMING.dwellLongMs).toBe(6000);
    expect(BANNER_TIMING.errorHoldMs).toBe(ERROR_HOLD_MS);
    expect(BANNER_TIMING.carryAcrossRouteMs).toBe(BANNER_CARRY_MS);
    expect(BANNER_TIMING.enterToken).toBe("--nf-duration-base");
    expect(BANNER_TIMING.exitToken).toBe("--nf-duration-fast");
  });

  it("carries a banner raised just before a route change onto the next page", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    banner.success("Signed in. Welcome back.");
    noteRouteChange(10_000 + BANNER_CARRY_MS - 1);
    expect(currentToast()?.message).toBe("Signed in. Welcome back.");
  });

  it("lets an older banner leave with the page it was about, never before a second on screen", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const seen: (string | null)[] = [];
    const off = subscribeToast((item) => seen.push(item?.message ?? null));
    banner.success("Removed from Saved.", { action: { label: "Undo", run: () => undefined } });
    noteRouteChange(10_000 + BANNER_CARRY_MS);
    expect(currentToast()).toBeNull();
    /* It leaves by the store going empty, so the host runs its exit; it is
       never swapped for something else in the same frame. */
    expect(seen).toEqual(["Removed from Saved.", null]);
    off();
  });

  it("drops a message waiting behind an error when its page goes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    banner.error("Could not save");
    banner.success("Saved");
    noteRouteChange(10_000 + BANNER_CARRY_MS + 5);
    expect(currentToast()).toBeNull();
    vi.advanceTimersByTime(ERROR_HOLD_MS * 2);
    expect(currentToast()).toBeNull();
  });

  it("changes a banner's words in place, keeping its id (no second entrance)", () => {
    const id = banner.success("Saved. It is in Saved.", { action: { label: "Undo", run: () => undefined } });
    expect(updateToast(id, { message: "Saved on this device. It is in Saved." })).toBe(true);
    expect(currentToast()?.id).toBe(id);
    expect(currentToast()?.message).toBe("Saved on this device. It is in Saved.");
    expect(currentToast()?.action?.label).toBe("Undo");
    expect(updateToast(id, { tone: "info", action: null })).toBe(true);
    expect(currentToast()?.action).toBeUndefined();
    expect(currentToast()?.tone).toBe("info");
  });

  it("does not update a banner that is no longer showing", () => {
    const old = banner.success("One");
    banner.success("Two");
    expect(updateToast(old, { message: "Changed" })).toBe(false);
    expect(currentToast()?.message).toBe("Two");
  });
});
