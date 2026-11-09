/**
 * DOC-06: `startRentPayment` and `payRentWithSavedCard` had no dedicated test.
 * The first opens a rent charge through `open_rent_charge` with the service
 * role; the second charges a saved card for somebody's rent. Pinned: the
 * tenant passed to the database is always the signed-in user, nothing is
 * opened or charged for a signed-out caller or a malformed request, every
 * refusal the database can give becomes an honest message rather than a
 * charge, and a saved-card payment is refused for a rent charge that belongs
 * to somebody else.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "../testing/fake-supabase";
import { RENT_PAYMENT_NOT_OPEN } from "../money/copy";

const state = vi.hoisted(() => ({
  session: null as unknown,
  admin: null as unknown,
  flag: true,
  /* The tests below the gate pin the path as it works once rent payment is
     opened; the gate itself is pinned in its own block at the end. */
  rentOpen: true,
  payWithSavedCard: vi.fn(async (_input: unknown) => ({ ok: true, data: { status: "paid" } })),
}));

vi.mock("../actions/session", () => ({
  resolveSession: async () => state.session,
  NOT_CONFIGURED_MESSAGE: "not configured",
  SIGNED_OUT_MESSAGE: "signed out",
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("../flags", () => ({ isFeatureEnabled: async () => state.flag }));
vi.mock("@/lib/supabase/service", () => ({ getAdminClient: () => state.admin }));
vi.mock("./payment-open", () => ({
  get RENT_PAYMENT_OPEN() {
    return state.rentOpen;
  },
}));
vi.mock("../bookings/checkout", () => ({ payWithSavedCard: (i: unknown) => state.payWithSavedCard(i) }));

const { startRentPayment, payRentWithSavedCard } = await import("./actions");

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "99999999-9999-4999-8999-999999999999";
const INSPECTION = "66666666-6666-4666-8666-666666666666";
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

let admin: ReturnType<typeof fakeSupabase>;
function rpcAnswers(answer: { data?: unknown; error?: unknown }) {
  admin = fakeSupabase({ open_rent_charge: { rpc: answer } });
  state.admin = admin.client;
}

beforeEach(() => {
  state.flag = true;
  state.rentOpen = true;
  state.payWithSavedCard.mockClear();
  state.session = { state: "signed-in", user: { id: ME }, supabase: fakeSupabase().client };
  rpcAnswers({ data: { status: "ok", booking_id: "b1", rent_payment_id: "r1", total_minor: 150_000_000 } });
});

describe("startRentPayment", () => {
  it("opens the charge for the signed-in tenant and returns what the database opened", async () => {
    const out = await startRentPayment({ inspectionId: INSPECTION, moveIn: future(3) });
    expect(out).toMatchObject({ ok: true, data: { bookingId: "b1", rentPaymentId: "r1", totalMinor: 150_000_000, opened: true } });
    expect(admin.of("open_rent_charge", "rpc")[0]?.values).toEqual({ p_tenant: ME, p_inspection: INSPECTION, p_move_in: future(3) });
  });

  it("opens nothing for a signed-out caller, a malformed id, a past move-in or while paused", async () => {
    state.session = { state: "signed-out" };
    expect((await startRentPayment({ inspectionId: INSPECTION })).ok).toBe(false);
    state.session = { state: "signed-in", user: { id: ME }, supabase: fakeSupabase().client };
    expect((await startRentPayment({ inspectionId: "inspection-1" })).ok).toBe(false);
    expect((await startRentPayment({ inspectionId: INSPECTION, moveIn: future(-3) })).ok).toBe(false);
    state.flag = false;
    expect((await startRentPayment({ inspectionId: INSPECTION })).ok).toBe(false);
    expect(admin.calls).toHaveLength(0);
  });

  it.each([
    ["not_found", /could not find that inspection/],
    ["not_accepted", /not accepted this inspection/],
    ["not_published", /no longer available/],
    ["no_amount", /move-in figure/],
    ["own_listing", /your own listing/],
    ["date_taken", /already taken/],
    ["something_new", /Nothing has been charged/],
  ])("turns the database's %s into a refusal", async (status, message) => {
    rpcAnswers({ data: { status } });
    const out = await startRentPayment({ inspectionId: INSPECTION, moveIn: future(3) });
    expect(out.ok).toBe(false);
    expect(JSON.stringify(out)).toMatch(message);
  });

  it("says an example listing has nothing to pay (the trigger's 23514), and a failure says nothing was charged", async () => {
    rpcAnswers({ data: null, error: { code: "23514", message: "demo" } });
    expect(JSON.stringify(await startRentPayment({ inspectionId: INSPECTION }))).toMatch(/example/);
    rpcAnswers({ data: null, error: { code: "57014", message: "timeout" } });
    expect(JSON.stringify(await startRentPayment({ inspectionId: INSPECTION }))).toMatch(/Nothing has been charged/);
  });

  it("refuses an ok status that is missing the ids it must carry", async () => {
    rpcAnswers({ data: { status: "ok" } });
    expect((await startRentPayment({ inspectionId: INSPECTION })).ok).toBe(false);
  });
});

describe("payRentWithSavedCard", () => {
  function tenantOfCharge(tenant: string | null) {
    const own = fakeSupabase({
      rent_payments: { select: { data: tenant === null ? null : { booking_id: "b1", tenant_id: tenant } } },
    });
    state.session = { state: "signed-in", user: { id: ME }, supabase: own.client };
    return own;
  }

  it("charges the saved card for the tenant's own rent charge", async () => {
    tenantOfCharge(ME);
    expect((await payRentWithSavedCard({ inspectionId: INSPECTION, methodId: "m1", idempotencyKey: "k" })).ok).toBe(true);
    expect(state.payWithSavedCard).toHaveBeenCalledWith({ bookingId: "b1", methodId: "m1", idempotencyKey: "k" });
  });

  it("never charges for somebody else's rent charge, or one that does not exist", async () => {
    tenantOfCharge(OTHER);
    expect((await payRentWithSavedCard({ inspectionId: INSPECTION, methodId: "m1" })).ok).toBe(false);
    tenantOfCharge(null);
    expect((await payRentWithSavedCard({ inspectionId: INSPECTION, methodId: "m1" })).ok).toBe(false);
    expect(state.payWithSavedCard).not.toHaveBeenCalled();
  });

  it("charges nothing for a signed-out caller or a malformed id", async () => {
    state.session = { state: "signed-out" };
    expect((await payRentWithSavedCard({ inspectionId: INSPECTION, methodId: "m1" })).ok).toBe(false);
    tenantOfCharge(ME);
    expect((await payRentWithSavedCard({ inspectionId: "x", methodId: "m1" })).ok).toBe(false);
    expect(state.payWithSavedCard).not.toHaveBeenCalled();
  });
});

describe("payment for rentals is not open (9 November 2026, RENT_PAYMENT_OPEN false)", () => {
  it("opens no charge and charges no card, saying why, before anything is read", async () => {
    state.rentOpen = false;
    const own = fakeSupabase({ rent_payments: { select: { data: { booking_id: "b1", tenant_id: ME } } } });
    state.session = { state: "signed-in", user: { id: ME }, supabase: own.client };
    const opened = await startRentPayment({ inspectionId: INSPECTION, moveIn: future(3) });
    expect(opened).toMatchObject({ ok: false, error: RENT_PAYMENT_NOT_OPEN });
    const charged = await payRentWithSavedCard({ inspectionId: INSPECTION, methodId: "m1" });
    expect(charged).toMatchObject({ ok: false, error: RENT_PAYMENT_NOT_OPEN });
    expect(admin.calls).toHaveLength(0);
    expect(own.calls).toHaveLength(0);
    expect(state.payWithSavedCard).not.toHaveBeenCalled();
  });

  it("is the launch position", async () => {
    const actual = await vi.importActual<typeof import("./payment-open")>("./payment-open");
    expect(actual.RENT_PAYMENT_OPEN).toBe(false);
  });
});
