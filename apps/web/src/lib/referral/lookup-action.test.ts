import { beforeEach, describe, expect, it, vi } from "vitest";

/* A plain function behind the mock: a `vi.fn` that returns a rejected promise
   makes vitest report the rejection it records as unhandled. */
const door = vi.hoisted(() => ({ calls: [] as string[], impl: (async () => null) as (code: string) => Promise<unknown> }));
vi.mock("./server", () => ({
  inviteDoor: (code: string) => {
    door.calls.push(code);
    return door.impl(code);
  },
}));

import { lookupReferrer } from "./lookup-action";

beforeEach(() => {
  door.calls.length = 0;
  door.impl = async () => null;
});

describe("lookupReferrer", () => {
  it("shows the referrer's first name for a pasted link", async () => {
    door.impl = async () => ({ found: true, firstName: "Ada" });
    expect(await lookupReferrer("https://vallo.ng/join/abc234")).toEqual({ state: "found", code: "ABC234", firstName: "Ada" });
    expect(door.calls).toEqual(["ABC234"]);
  });
  it("answers unknown, unreadable and empty without asking for what it cannot parse", async () => {
    door.impl = async () => ({ found: false, firstName: null });
    expect(await lookupReferrer("ABC234")).toEqual({ state: "unknown" });
    expect(await lookupReferrer("hello")).toEqual({ state: "unreadable" });
    expect(await lookupReferrer("  ")).toEqual({ state: "empty" });
    expect(door.calls).toHaveLength(1);
  });
  it("is busy, never an error, when the door refuses or throws", async () => {
    expect(await lookupReferrer("ABC234")).toEqual({ state: "busy" });
    door.impl = async () => {
      throw new Error("x");
    };
    expect(await lookupReferrer("ABC234")).toEqual({ state: "busy" });
  });
});
