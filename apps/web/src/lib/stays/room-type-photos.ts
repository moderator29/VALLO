/**
 * Photographs of a ROOM TYPE, read (`room_type_photos`).
 *
 * The third photo table, one level below `accommodation_photos`: up to ten
 * rows per room type, position 0 the cover, `storage_path` a path inside the
 * same PUBLIC `accommodation-photos` bucket, turned into a URL by the one
 * `accommodationPhotoUrl`. The table's RLS answers who may read: anybody for a
 * room type on the shelf (the room type, its property and its business all
 * PUBLISHED), the owner for their own at any status, an admin for any.
 *
 * THE TABLE MAY NOT EXIST YET. It arrives with
 * `supabase/migrations/pending/room_type_photos_2026-11-17.sql`, which the
 * founder runs by hand, and until then every read answers "relation does not
 * exist" (PGRST205 from PostgREST, 42P01 from Postgres). That is not a fault
 * anybody should see: the read comes back `unavailable`, the host's room
 * screen hides its photograph block and the stay page draws its rooms exactly
 * as it did before. Any other failure is treated the same way, because a room
 * photograph is never worth taking a page down for. Nothing here throws.
 *
 * Untyped on purpose: `database.types.ts` is generated from the live schema,
 * and hand-writing a table the live database does not have yet would make the
 * type system assert something untrue. The rows are checked here instead.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { accommodationPhotoUrl } from "./photos";
import { MAX_BUSINESS_PHOTOS } from "../host/photos";

export type RoomTypePhoto = {
  id: string;
  /** The stored path, which is what a write and a delete work on. */
  storagePath: string;
  /** The public URL, which is what a surface renders. */
  url: string;
  /** 0 is the cover. */
  position: number;
};

/** Every asked room type's photographs, cover first, or `unavailable`. */
export type RoomTypePhotosRead =
  | { state: "ok"; byRoom: Map<string, RoomTypePhoto[]> }
  | { state: "unavailable" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when the error says the table is not there yet (PostgREST PGRST205, Postgres 42P01). */
export function roomTypePhotosMissing(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

type Row = { id: unknown; room_type_id: unknown; storage_path: unknown; position: unknown };

/** Rows as the table returns them, grouped by room type and ordered cover first. */
export function groupRoomTypePhotos(rows: readonly Row[]): Map<string, RoomTypePhoto[]> {
  const byRoom = new Map<string, RoomTypePhoto[]>();
  for (const row of rows) {
    if (typeof row.id !== "string" || typeof row.room_type_id !== "string") continue;
    if (typeof row.storage_path !== "string" || row.storage_path.length === 0) continue;
    if (typeof row.position !== "number" || !Number.isInteger(row.position)) continue;
    const list = byRoom.get(row.room_type_id) ?? [];
    list.push({
      id: row.id,
      storagePath: row.storage_path,
      url: accommodationPhotoUrl(row.storage_path),
      position: row.position,
    });
    byRoom.set(row.room_type_id, list);
  }
  for (const list of byRoom.values()) {
    list.sort((a, b) => a.position - b.position);
    list.splice(MAX_BUSINESS_PHOTOS);
  }
  return byRoom;
}

/**
 * The photographs of these room types, through the caller's own client (and
 * so the caller's own RLS). An empty list of ids is answered without a query.
 */
export async function readRoomTypePhotos(
  client: unknown,
  roomTypeIds: readonly string[],
): Promise<RoomTypePhotosRead> {
  const ids = [...new Set(roomTypeIds)].filter((id) => UUID_RE.test(id));
  if (ids.length === 0) return { state: "ok", byRoom: new Map() };
  try {
    const db = client as SupabaseClient;
    const { data, error } = await db
      .from("room_type_photos")
      .select("id, room_type_id, storage_path, position")
      .in("room_type_id", ids)
      .order("position", { ascending: true })
      .limit(ids.length * MAX_BUSINESS_PHOTOS);
    if (error || !Array.isArray(data)) return { state: "unavailable" };
    return { state: "ok", byRoom: groupRoomTypePhotos(data as Row[]) };
  } catch {
    return { state: "unavailable" };
  }
}
