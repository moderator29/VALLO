import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The venue marks a table seated or no-show. When the diner already said
 * otherwise, the seating function records the mark AND opens a dispute: that
 * is a saved mark, so the action answers ok with `disputed: true`, never a
 * failure the desk would draw in red.
 */

const session = vi.hoisted(() => ({ resolveSession: vi.fn() }));
vi.mock("../actions/session", () => session);
vi.mock("../messages/actions", () => ({ startReservationThread: vi.fn(), sendMessage: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("server-only", () => ({}));

const { markReservationOutcome } = await import("./actions");

const TABLE = "55555555-5555-4555-8555-555555555555";

function seating(answer: { data: unknown; error: unknown }) {
  const rpc = vi.fn(async () => answer);
  session.resolveSession.mockResolvedValue({ state: "signed-in", user: { id: "venue" }, supabase: { rpc } });
  return rpc;
}

beforeEach(() => session.resolveSession.mockReset());

describe("markReservationOutcome", () => {
  it("answers ok for a recorded mark", async () => {
    seating({ data: { status: "recorded" }, error: null });
    const result = await markReservationOutcome({ reservationId: TABLE, outcome: "COMPLETED" });
    expect(result).toEqual({ ok: true, data: { outcome: "COMPLETED", disputed: false } });
  });

  it("answers ok, disputed, when the mark was recorded and a dispute opened", async () => {
    const rpc = seating({ data: { status: "disputed" }, error: null });
    const result = await markReservationOutcome({ reservationId: TABLE, outcome: "NO_SHOW" });
    expect(result).toEqual({ ok: true, data: { outcome: "NO_SHOW", disputed: true } });
    expect(rpc).toHaveBeenCalledWith("reservation_record_outcome", { p_reservation: TABLE, p_outcome: "NO_SHOW" });
  });

  it("still fails on a refusal", async () => {
    seating({ data: { status: "too_early" }, error: null });
    const result = await markReservationOutcome({ reservationId: TABLE, outcome: "COMPLETED" });
    expect(result.ok).toBe(false);
  });
});
