/**
 * A SAVE IS ANSWERED ON THE TAP (Agent FEEL, 13 November 2026). The order of
 * events pinned: the heart and the banner before the server is even asked to
 * settle, the state wanted (never "flip"), a refusal rolled back with Try
 * again, a later tap never undone by an earlier answer, a signed-out save
 * turned into a device save in place.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  calls: [] as unknown[],
  answers: [] as ((value: unknown) => void)[],
  local: [] as string[],
}));

vi.mock("./actions", () => ({
  toggleSave: (input: unknown) => {
    state.calls.push(input);
    return new Promise((resolve) => state.answers.push(resolve));
  },
}));
vi.mock("./places-actions", () => ({
  saveStay: vi.fn(),
  unsaveStay: vi.fn(),
  saveRestaurant: vi.fn(),
  unsaveRestaurant: vi.fn(),
}));
vi.mock("./local", () => ({
  addLocalSave: (id: string) => state.local.push(`+${id}`),
  removeLocalSave: (id: string) => state.local.push(`-${id}`),
}));
vi.mock("../offline/send-or-keep", () => ({
  setOrKeep: async (_kind: string, _target: string, _want: boolean, send: () => Promise<unknown>) => ({
    state: "sent",
    result: await send(),
  }),
}));
vi.mock("../offline/tap-failed", () => ({ tapFailedOffline: () => false }));

import { currentToast, dismissToast } from "../ui/toast";
import { resetSessionSaves, savedChangeVersion, savesInFlight, tapSave, whenSavesSettle } from "./save-flow";

const LISTING = "00000000-0000-4000-8000-0000000000aa";
const WORDS = { savedWaiting: "Saved. Waiting for signal", removedWaiting: "Removed. Waiting for signal", couldNotKeep: "Could not keep it" };

function tap(next: boolean, apply: (v: boolean) => void, listingId = LISTING) {
  return tapSave({ target: { listingId }, next, apply, words: WORDS, deviceChanged: () => undefined });
}

beforeEach(() => {
  state.calls = [];
  state.answers = [];
  state.local = [];
  resetSessionSaves();
});
afterEach(() => {
  dismissToast();
  dismissToast();
});

describe("a save, answered on the tap", () => {
  it("flips and raises the banner before the server answers, sending the state wanted", () => {
    const applied: boolean[] = [];
    void tap(true, (v) => applied.push(v));
    expect(applied).toEqual([true]);
    expect(currentToast()?.message).toBe("Saved. It is in Saved.");
    expect(currentToast()?.action?.label).toBe("Undo");
    expect(state.calls).toEqual([{ listingId: LISTING, want: true }]);
    expect(state.answers).toHaveLength(1);
    expect(savesInFlight()).toBe(true);
  });

  it("puts the heart back on a refusal and says why, with Try again", async () => {
    const applied: boolean[] = [];
    const done = tap(true, (v) => applied.push(v));
    state.answers[0]!({ ok: false, error: "We could not update your shortlist just now." });
    await done;
    expect(applied).toEqual([true, false]);
    expect(currentToast()?.tone).toBe("error");
    expect(currentToast()?.message).toBe("We could not update your shortlist just now.");
    expect(currentToast()?.action?.label).toBe("Try again");
    expect(savesInFlight()).toBe(false);
  });

  it("never lets an earlier answer undo a later tap", async () => {
    const applied: boolean[] = [];
    const first = tap(true, (v) => applied.push(v));
    const second = tap(false, (v) => applied.push(v));
    /* The first fails after the second tap: the heart stays where the second put it. */
    state.answers[0]!({ ok: false, error: "Refused" });
    state.answers[1]!({ ok: true, data: { mode: "db", listingId: LISTING, saved: false } });
    await Promise.all([first, second]);
    expect(applied).toEqual([true, false]);
    expect(currentToast()?.message).toBe("Removed from Saved.");
  });

  it("turns a signed-out save into a device save, changing the words in place", async () => {
    const applied: boolean[] = [];
    const done = tap(true, (v) => applied.push(v));
    const id = currentToast()?.id;
    state.answers[0]!({ ok: false, error: "Sign in to save this." });
    await done;
    expect(applied).toEqual([true]);
    expect(state.local).toEqual([`+${LISTING}`]);
    expect(currentToast()?.id).toBe(id);
    expect(currentToast()?.message).toBe("Saved on this device. It is in Saved.");
  });

  it("keeps a catalogue id on the device without asking the server", async () => {
    await tap(true, () => undefined, "lagos-yaba-12");
    expect(state.calls).toEqual([]);
    expect(state.local).toEqual(["+lagos-yaba-12"]);
    expect(currentToast()?.message).toBe("Saved on this device. It is in Saved.");
  });

  it("counts every answer so /saved knows to refresh, and says when the writes have landed", async () => {
    const before = savedChangeVersion();
    const done = tap(true, () => undefined);
    expect(savedChangeVersion()).toBeGreaterThan(before);
    let settled = false;
    void whenSavesSettle().then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    state.answers[0]!({ ok: true, data: { mode: "db", listingId: LISTING, saved: true } });
    await done;
    await Promise.resolve();
    expect(settled).toBe(true);
  });
});
