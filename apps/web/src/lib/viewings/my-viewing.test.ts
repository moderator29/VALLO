import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({
  row: null as null | Record<string, unknown>,
  rpc: { data: null as unknown, error: null as null | { hint?: string } },
  close: vi.fn(),
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("../locale", () => ({ getLocale: async () => "en" }));
vi.mock("../inspections/actions", () => ({ closeInspection: (...a: unknown[]) => seam.close(...a) }));
vi.mock("../actions/session", () => ({
  resolveSession: async () => ({
    state: "signed-in",
    user: { id: "u1" },
    supabase: {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: seam.row, error: null }) }) }) }),
      rpc: async (fn: string, args: Record<string, unknown>) => {
        seam.rpcCalls.push({ fn, args });
        return seam.rpc;
      },
    },
  }),
}));

const { cancelMyViewing, rescheduleMyViewing } = await import("./actions");
const ID = "55555555-5555-4555-8555-555555555555";
const ahead = new Date(Date.now() + 2 * 86_400_000).toISOString();

beforeEach(() => {
  seam.row = { id: ID, listing_id: "l1", requester_id: "u1", state: "CONFIRMED", slot_at: ahead, requested_at: ahead };
  seam.rpc = { data: null, error: null };
  seam.close.mockReset();
  seam.rpcCalls = [];
});

describe("the renter cancels or moves their own viewing", () => {
  it("cancels through the existing withdrawal", async () => {
    seam.close.mockResolvedValue({ ok: true, data: null });
    expect(await cancelMyViewing({ id: ID })).toMatchObject({ ok: true });
    expect(seam.close).toHaveBeenCalledWith({ id: ID, state: "WITHDRAWN" });
  });

  it("refuses somebody else's viewing", async () => {
    seam.row = { ...seam.row!, requester_id: "someone-else" };
    expect((await cancelMyViewing({ id: ID })).ok).toBe(false);
    expect((await rescheduleMyViewing({ id: ID, slotAt: ahead })).ok).toBe(false);
    expect(seam.close).not.toHaveBeenCalled();
    expect(seam.rpcCalls).toEqual([]);
  });

  it("moves through the atomic database function and says the old time stands when it refuses", async () => {
    seam.rpc = { data: null, error: { hint: "viewing_slot_taken" } };
    const out = await rescheduleMyViewing({ id: ID, slotAt: ahead });
    expect(out).toMatchObject({ ok: false, error: "That time is no longer free. Pick another." });
    expect(seam.rpcCalls[0]?.fn).toBe("reschedule_my_viewing");
    seam.rpc = { data: "66666666-6666-4666-8666-666666666666", error: null };
    expect(await rescheduleMyViewing({ id: ID, slotAt: ahead })).toMatchObject({ ok: true, data: { id: "66666666-6666-4666-8666-666666666666" } });
  });
});
