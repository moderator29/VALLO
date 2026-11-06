import { describe, expect, it } from "vitest";
import { RETRY_AFTER_MS, shouldReload } from "./watch";

const base = { mine: "dpl_old", live: "dpl_new", editing: false, tried: null, now: 1_000_000 };

describe("shouldReload", () => {
  it("reloads when the live deploy is not the one running", () => {
    expect(shouldReload(base)).toBe(true);
  });
  it("does nothing when they match, or when either is unknown", () => {
    expect(shouldReload({ ...base, live: "dpl_old" })).toBe(false);
    expect(shouldReload({ ...base, mine: "" })).toBe(false);
    expect(shouldReload({ ...base, live: "" })).toBe(false);
  });
  it("never reloads under somebody who is typing", () => {
    expect(shouldReload({ ...base, editing: true })).toBe(false);
  });
  it("does not loop: the same deploy is not retried for half an hour", () => {
    expect(shouldReload({ ...base, tried: { id: "dpl_new", at: base.now - 1000 } })).toBe(false);
    expect(shouldReload({ ...base, tried: { id: "dpl_new", at: base.now - RETRY_AFTER_MS - 1 } })).toBe(true);
  });
  it("tries again for a newer deploy straight away", () => {
    expect(shouldReload({ ...base, tried: { id: "dpl_older", at: base.now - 1000 } })).toBe(true);
  });
});
