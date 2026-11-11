import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE REFUND DESK AGAINST A BOOKING THAT WAS ALREADY PART REFUNDED.
 *
 * `refundBookingAsAdmin` can hand money back without cancelling (goodwill, a
 * duplicate charge). If that stay is later cancelled, the amount the desk
 * decides has to fit inside what is STILL refundable: the database refuses
 * anything above `paid - already refunded` and answers `over_refund`, which
 * leaves the booking live and the operator with nothing to do.
 *
 * These tests drive the action with the database mocked, so the figure it
 * sends is the only thing under test.
 */

const seam = vi.hoisted(() => ({
  access: { state: "admin" } as { state: string },
  tables: {} as Record<string, unknown>,
  rpc: vi.fn(),
  submit: vi.fn(),
}));

function table(rows: unknown) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: Array.isArray(rows) ? (rows[0] ?? null) : rows, error: null }),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve, reject),
  };
  return chain;
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./guard", () => ({
  adminRefusal: () => "forbidden",
  requireAdmin: async () => ({
    ...seam.access,
    user: { id: "00000000-0000-4000-8000-0000000000aa" },
    supabase: { from: (name: string) => table(seam.tables[name] ?? []) },
  }),
}));
vi.mock("../supabase/admin", () => ({
  createAdminClient: () => ({ rpc: (fn: string, args: Record<string, unknown>) => seam.rpc(fn, args) }),
}));
vi.mock("../after-gate/refunds", () => ({ readFrozenTerms: async () => null }));
vi.mock("../payments/refund", () => ({ submitBookingRefund: (...a: unknown[]) => seam.submit(...a) }));
vi.mock("./audit", () => ({ writeAudit: async () => undefined }));
vi.mock("../email/client", () => ({ bestEffortEmail: async () => undefined, sendMessage: async () => undefined }));
vi.mock("../email/recipients", () => ({ contactForUser: async () => null }));
vi.mock("../email/messages", () => ({ bookingRefunded: () => ({}) }));
vi.mock("../email/mail-language", () => ({ mailLanguageFor: async () => ({}) }));
vi.mock("../bookings/stay-title", () => ({ stayTitle: async () => "a stay" }));
vi.mock("../notify/in-app", () => ({ writeInAppNotice: async () => undefined }));
vi.mock("./bookings-queries", () => ({
  RESERVATION_ALREADY_ANSWERED: "already",
  reservationTransition: async () => ({ status: "ok" }),
}));

const { cancelBookingAsAdmin } = await import("./bookings-actions");

const BOOKING = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  seam.access = { state: "admin" };
  seam.rpc.mockReset();
  seam.submit.mockReset();
  seam.submit.mockResolvedValue({ ok: true });
  seam.tables = {
    bookings: [
      {
        id: BOOKING,
        listing_id: "00000000-0000-4000-8000-000000000002",
        accommodation_id: null,
        guest_id: "00000000-0000-4000-8000-000000000003",
        status: "CONFIRMED",
        check_in: "2026-12-20",
        check_out: "2026-12-24",
        total_minor: 100_000,
      },
    ],
    transactions: [{ amount_minor: 100_000 }],
    booking_refunds: [],
  };
});

describe("cancelBookingAsAdmin and refunds already made", () => {
  it("asks for the whole payment back when nothing has been refunded yet", async () => {
    seam.rpc.mockResolvedValue({
      data: { status: "ok", refund_minor: 100_000, retained_minor: 0, paid_minor: 100_000, refund_id: "r1" },
      error: null,
    });
    const result = await cancelBookingAsAdmin({ bookingId: BOOKING, reason: "host_cancelled", note: "The agent withdrew the property." });
    expect(result.ok).toBe(true);
    expect(seam.rpc.mock.calls[0]?.[1]).toMatchObject({ refund_amount: 100_000 });
  });

  it("asks only for what is still refundable when a part refund already went back", async () => {
    seam.tables.booking_refunds = [{ refund_minor: 30_000 }];
    seam.rpc.mockResolvedValue({
      data: { status: "ok", refund_minor: 70_000, retained_minor: 0, paid_minor: 100_000, refund_id: "r2" },
      error: null,
    });
    const result = await cancelBookingAsAdmin({ bookingId: BOOKING, reason: "host_cancelled", note: "The agent withdrew the property." });
    /* Unbounded this asks for 100,000 against 70,000 refundable, the database
       answers over_refund and the stay cannot be cancelled at all. */
    expect(seam.rpc.mock.calls[0]?.[1]).toMatchObject({ refund_amount: 70_000 });
    expect(result.ok).toBe(true);
  });

  it("asks for nothing when every kobo has already gone back", async () => {
    seam.tables.booking_refunds = [{ refund_minor: 60_000 }, { refund_minor: 40_000 }];
    seam.rpc.mockResolvedValue({
      data: { status: "ok", refund_minor: 0, retained_minor: 0, paid_minor: 100_000, refund_id: null },
      error: null,
    });
    const result = await cancelBookingAsAdmin({ bookingId: BOOKING, reason: "host_cancelled", note: "The agent withdrew the property." });
    expect(seam.rpc.mock.calls[0]?.[1]).toMatchObject({ refund_amount: 0 });
    expect(result.ok).toBe(true);
    expect(seam.submit).not.toHaveBeenCalled();
  });
});
