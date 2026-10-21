import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The renter's visit page learns the booked slot's length through the
 * service role, because RLS answers `viewing_windows` to the lister only and
 * the renter's own client always read nothing (slotMinutes was always null).
 */

const admin = vi.hoisted(() => ({ answer: { data: null as unknown, error: null as unknown }, ids: [] as string[] }));
vi.mock("server-only", () => ({}));
vi.mock("../supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = (_column: string, value: string) => {
        admin.ids.push(`${table}:${value}`);
        return chain;
      };
      chain.maybeSingle = async () => admin.answer;
      return chain;
    },
  }),
}));

const { readSlotMinutes } = await import("./visit-queries");

beforeEach(() => {
  admin.answer = { data: null, error: null };
  admin.ids = [];
});

describe("readSlotMinutes", () => {
  it("reads the one window's slot length", async () => {
    admin.answer = { data: { slot_minutes: 30 }, error: null };
    expect(await readSlotMinutes("w-1")).toBe(30);
    expect(admin.ids).toEqual(["viewing_windows:w-1"]);
  });

  it("is null with no window, on an error, or for a nonsense length", async () => {
    expect(await readSlotMinutes(null)).toBeNull();
    expect(admin.ids).toEqual([]);
    admin.answer = { data: null, error: { message: "boom" } };
    expect(await readSlotMinutes("w-1")).toBeNull();
    admin.answer = { data: { slot_minutes: 0 }, error: null };
    expect(await readSlotMinutes("w-1")).toBeNull();
  });
});
