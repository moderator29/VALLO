import { describe, expect, it } from "vitest";
import { groupRoomTypePhotos, readRoomTypePhotos, roomTypePhotosMissing } from "./room-type-photos";

const A = "6a1d2c3b-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const B = "7b2e3d4c-5f6a-4b7c-9d8e-0f1a2b3c4d5e";

/** A client whose one query answers with `result`, recording what it was asked. */
function client(result: { data: unknown; error: unknown }) {
  const asked: { table?: string; ids?: unknown } = {};
  const chain: Record<string, unknown> = {
    select: () => chain,
    in: (_column: string, ids: unknown) => {
      asked.ids = ids;
      return chain;
    },
    order: () => chain,
    limit: async () => result,
  };
  return {
    asked,
    db: {
      from: (table: string) => {
        asked.table = table;
        return chain;
      },
    },
  };
}

describe("room type photographs, read", () => {
  it("groups the rows by room type, cover first", () => {
    const byRoom = groupRoomTypePhotos([
      { id: "p2", room_type_id: A, storage_path: "u/a/2.jpg", position: 1 },
      { id: "p1", room_type_id: A, storage_path: "u/a/1.jpg", position: 0 },
      { id: "p3", room_type_id: B, storage_path: "u/b/1.jpg", position: 0 },
    ]);
    expect(byRoom.get(A)?.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(byRoom.get(B)?.map((p) => p.id)).toEqual(["p3"]);
    expect(byRoom.get(A)?.[0]?.url).toMatch(/\/storage\/v1\/object\/public\/accommodation-photos\/u\/a\/1\.jpg$/);
  });

  it("drops a row that is not the shape the table promises", () => {
    const byRoom = groupRoomTypePhotos([
      { id: "p1", room_type_id: A, storage_path: "", position: 0 },
      { id: "p2", room_type_id: A, storage_path: "u/a/2.jpg", position: "1" },
      { id: null, room_type_id: A, storage_path: "u/a/3.jpg", position: 2 },
    ]);
    expect(byRoom.size).toBe(0);
  });

  it("asks nothing for no room types", async () => {
    const { db, asked } = client({ data: [], error: null });
    const read = await readRoomTypePhotos(db, []);
    expect(read.state).toBe("ok");
    expect(asked.table).toBeUndefined();
  });

  it("reads the asked room types from room_type_photos", async () => {
    const { db, asked } = client({
      data: [{ id: "p1", room_type_id: A, storage_path: "u/a/1.jpg", position: 0 }],
      error: null,
    });
    const read = await readRoomTypePhotos(db, [A, A, "not-an-id"]);
    expect(asked.table).toBe("room_type_photos");
    expect(asked.ids).toEqual([A]);
    expect(read.state === "ok" && read.byRoom.get(A)?.length).toBe(1);
  });

  it("answers unavailable, quietly, while the table is not on the database", async () => {
    const { db } = client({ data: null, error: { code: "PGRST205", message: "Could not find the table" } });
    expect(await readRoomTypePhotos(db, [A])).toEqual({ state: "unavailable" });
    expect(roomTypePhotosMissing({ code: "PGRST205" })).toBe(true);
    expect(roomTypePhotosMissing({ code: "42P01" })).toBe(true);
    expect(roomTypePhotosMissing({ code: "42501" })).toBe(false);
  });

  it("answers unavailable when the client throws", async () => {
    const db = {
      from: () => {
        throw new Error("down");
      },
    };
    expect(await readRoomTypePhotos(db, [A])).toEqual({ state: "unavailable" });
  });
});
