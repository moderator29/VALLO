import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Staff decide a disagreement between a restaurant and a diner. Nobody decides
 * a table they booked, own or list (the fee per seated table and the right to
 * review follow the outcome), and only an open disagreement is decided.
 */

const STAFF = "55555555-5555-4555-8555-555555555555";
const RES = "22222222-2222-4222-8222-222222222222";

const state = vi.hoisted(() => ({
  reservation: null as Record<string, unknown> | null,
  seating: null as Record<string, unknown> | null,
  owner: null as string | null,
  agentUser: null as string | null,
  meRpcs: [] as { fn: string; args: Record<string, unknown> }[],
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("../flags/read", () => ({ flagIsOn: async () => false }));
vi.mock("../phone-otp/gate", () => ({ phoneGateFor: async () => null }));
vi.mock("../payments/paystack", () => ({
  PaystackError: class extends Error {},
  PaystackUnknownOutcome: class extends Error {},
  currentPaystackMode: () => "test",
  isPaystackConfigured: () => true,
  verifyTransaction: async () => ({}),
}));
vi.mock("../payments/providers", () => ({ assertProviderEnabled: async () => undefined, paystackSeam: () => ({}), openCheckout: async () => ({}) }));
vi.mock("../actions/session", () => ({
  NOT_CONFIGURED_MESSAGE: "not configured",
  SIGNED_OUT_MESSAGE: "signed out",
  resolveSession: async () => ({
    state: "signed-in",
    user: { id: STAFF, email: "staff@vallo.test" },
    supabase: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        state.meRpcs.push({ fn, args });
        return { data: { status: "resolved" }, error: null };
      },
    },
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  getAdminClient: () => ({
    from: (table: string) => {
      const data = () => {
        if (table === "reservations") return state.reservation;
        if (table === "reservation_seatings") return state.seating;
        if (table === "businesses") return { owner_id: state.owner };
        if (table === "listings") return { agents: state.agentUser ? { user_id: state.agentUser } : null };
        return null;
      };
      const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: data(), error: null }) };
      return chain;
    },
  }),
}));

const { resolveSeatingDispute } = await import("./seating-actions");
const { SEATING_REFUSALS } = await import("./seating");

beforeEach(() => {
  state.reservation = { guest_id: "66666666-6666-4666-8666-666666666666", business_id: "77777777-7777-4777-8777-777777777777", listing_id: null };
  state.seating = { disputed_at: "2026-10-16T19:00:00Z", dispute_resolved_at: null };
  state.owner = "88888888-8888-4888-8888-888888888888";
  state.agentUser = null;
  state.meRpcs = [];
});

describe("resolveSeatingDispute", () => {
  it("decides an open disagreement on somebody else's table", async () => {
    const r = await resolveSeatingDispute(RES, "SEATED");
    expect(r.ok).toBe(true);
    expect(state.meRpcs).toEqual([{ fn: "reservation_resolve_seating", args: { p_reservation: RES, p_outcome: "SEATED" } }]);
  });

  it("refuses the diner deciding their own table", async () => {
    state.reservation = { ...state.reservation, guest_id: STAFF };
    expect(await resolveSeatingDispute(RES, "NO_SHOW")).toEqual({ ok: false, error: SEATING_REFUSALS.own_table });
    expect(state.meRpcs).toHaveLength(0);
  });

  it("refuses the restaurant's owner deciding it", async () => {
    state.owner = STAFF;
    expect((await resolveSeatingDispute(RES, "SEATED")).ok).toBe(false);
    expect(state.meRpcs).toHaveLength(0);
  });

  it("refuses the agent listing the venue deciding it", async () => {
    state.reservation = { ...state.reservation, business_id: null, listing_id: "99999999-9999-4999-8999-999999999999" };
    state.agentUser = STAFF;
    expect((await resolveSeatingDispute(RES, "SEATED")).ok).toBe(false);
    expect(state.meRpcs).toHaveLength(0);
  });

  it("refuses a table nobody disputed, or one already decided", async () => {
    state.seating = { disputed_at: null, dispute_resolved_at: null };
    expect(await resolveSeatingDispute(RES, "SEATED")).toEqual({ ok: false, error: SEATING_REFUSALS.not_disputed });
    state.seating = { disputed_at: "2026-10-16T19:00:00Z", dispute_resolved_at: "2026-10-17T09:00:00Z" };
    expect((await resolveSeatingDispute(RES, "SEATED")).ok).toBe(false);
    expect(state.meRpcs).toHaveLength(0);
  });
});
