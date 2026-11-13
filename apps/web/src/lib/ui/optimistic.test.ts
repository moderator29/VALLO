/**
 * SAY IT ON THE TAP, SETTLE IT BEHIND (Agent FEEL, 13 November 2026): the
 * banner is up before the server is awaited; a refusal rolls back and says
 * why; a tap kept for later changes the words in place.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../offline/tap-failed", () => ({ tapFailedOffline: () => false }));

import { currentToast, dismissToast } from "./toast";
import { sayNowSettleLater } from "./optimistic";

afterEach(() => {
  dismissToast();
  dismissToast();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("sayNowSettleLater", () => {
  it("raises the banner before the server answers", () => {
    const answer = deferred<never>();
    void sayNowSettleLater({
      message: "You follow @ada_o.",
      send: () => answer.promise,
      rollBack: () => undefined,
      notKeptWords: "Not kept",
    });
    expect(currentToast()?.message).toBe("You follow @ada_o.");
    expect(currentToast()?.tone).toBe("success");
  });

  it("offers Undo when there is a real inverse", () => {
    void sayNowSettleLater({
      message: "Saved.",
      undo: { undo: async () => ({ ok: true }), undone: "Removed." },
      send: () => new Promise(() => undefined),
      rollBack: () => undefined,
      notKeptWords: "Not kept",
    });
    expect(currentToast()?.action?.label).toBe("Undo");
  });

  it("rolls back and says why on a refusal, with Try again", async () => {
    const rollBack = vi.fn();
    const retry = vi.fn();
    const result = await sayNowSettleLater({
      message: "Saved.",
      send: async () => ({ state: "sent", result: { ok: false, error: "You cannot do that." } }),
      rollBack,
      retry,
      notKeptWords: "Not kept",
    });
    expect(result).toBeNull();
    expect(rollBack).toHaveBeenCalledOnce();
    expect(currentToast()?.tone).toBe("error");
    expect(currentToast()?.message).toBe("You cannot do that.");
    currentToast()?.action?.run();
    expect(retry).toHaveBeenCalledOnce();
  });

  it("changes the words in place when the tap is kept for later", async () => {
    const pending = sayNowSettleLater({
      message: "Saved.",
      send: async () => ({ state: "kept" }),
      rollBack: () => undefined,
      keptWords: "Saved. It goes when there is signal.",
      notKeptWords: "Not kept",
    });
    const id = currentToast()?.id;
    await pending;
    expect(currentToast()?.id).toBe(id);
    expect(currentToast()?.message).toBe("Saved. It goes when there is signal.");
    expect(currentToast()?.tone).toBe("info");
  });

  it("rolls back when the call throws", async () => {
    const rollBack = vi.fn();
    await sayNowSettleLater({
      message: "Saved.",
      send: async () => {
        throw new Error("boom");
      },
      rollBack,
      notKeptWords: "That did not go through.",
    });
    expect(rollBack).toHaveBeenCalledOnce();
    expect(currentToast()?.message).toBe("That did not go through.");
  });

  it("returns the accepted answer for the caller to reconcile", async () => {
    const result = await sayNowSettleLater({
      message: "Saved.",
      send: async () => ({ state: "sent", result: { ok: true, data: { following: true } } }),
      rollBack: () => undefined,
      notKeptWords: "Not kept",
    });
    expect(result).toEqual({ ok: true, data: { following: true } });
  });
});
