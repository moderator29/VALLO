import { describe, expect, it } from "vitest";
import { moveId } from "./photo-order";

describe("moveId", () => {
  it("moves a photograph to a new place and keeps the rest in order", () => {
    expect(moveId(["a", "b", "c", "d"], "d", 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveId(["a", "b", "c", "d"], "a", 2)).toEqual(["b", "c", "a", "d"]);
  });
  it("returns the same array when nothing moves", () => {
    const ids = ["a", "b"];
    expect(moveId(ids, "a", 0)).toBe(ids);
    expect(moveId(ids, "zzz", 1)).toBe(ids);
  });
});
