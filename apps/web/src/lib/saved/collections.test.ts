import { describe, expect, it } from "vitest";
import { cleanCollectionName, collectionKey, inCollection, COLLECTION_NAME_MAX } from "./collections";

describe("saved collections", () => {
  it("tidies a name and refuses an empty one", () => {
    expect(cleanCollectionName("  Lagos   shortlist ")).toBe("Lagos shortlist");
    expect(cleanCollectionName("   ")).toBeNull();
    expect(cleanCollectionName("x".repeat(100))?.length).toBe(COLLECTION_NAME_MAX);
  });

  it("filters the board to one list, across the three shelves", () => {
    const items = [{ id: "a" }, { id: "b", place: { kind: "accommodation" } }, { id: "c", place: { kind: "restaurant" } }];
    const list = { id: "l", name: "Trip", keys: [collectionKey("listing", "a"), collectionKey("accommodation", "b")] };
    expect(inCollection(items, list).map((i) => i.id)).toEqual(["a", "b"]);
    expect(inCollection(items, null)).toHaveLength(3);
  });
});
