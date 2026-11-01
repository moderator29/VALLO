import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => ({
  signedIn: true,
  rpc: {} as Record<string, unknown>,
  calls: [] as { fn: string; args?: Record<string, unknown> }[],
  proposal: null as null | { id: string; kind: string; status: string; payload: Record<string, unknown>; result: null },
  booking: null as null | Record<string, unknown>,
  locked: null as string | null,
  book: vi.fn(),
  save: vi.fn(),
  checkout: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/security/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security/rate-limit")>("@/lib/security/rate-limit");
  return { ...actual, consume: async () => ({ allowed: true, degraded: false }) };
});
vi.mock("@/lib/actions/session", () => ({
  resolveSession: async () =>
    seam.signedIn
      ? {
          state: "signed-in",
          user: { id: "u1" },
          supabase: {
            rpc: async (fn: string, args?: Record<string, unknown>) => {
              seam.calls.push({ fn, ...(args ? { args } : {}) });
              const a = seam.rpc[fn];
              return { data: typeof a === "function" ? (a as (x?: unknown) => unknown)(args) : a, error: null };
            },
            from: (table: string) => ({
              select: () => ({
                eq: () => ({
                  eq: () => ({ maybeSingle: async () => ({ data: table === "bookings" ? seam.booking : table === "listings" ? { title: "Two bed" } : null }) }),
                  maybeSingle: async () =>
                    table === "ai_action_proposals"
                      ? { data: seam.proposal }
                      : table === "bookings"
                        ? { data: seam.booking ?? { status: "PENDING" } }
                        : { data: { title: "Two bed" } },
                  order: () => ({ limit: async () => ({ data: [] }) }),
                }),
              }),
            }),
          },
        }
      : { state: "signed-out" },
}));
vi.mock("@/lib/passcode/money", () => ({ passcodeMoneyRefusal: async () => seam.locked }));
vi.mock("@/lib/viewings/actions", () => ({ bookViewingSlot: (...a: unknown[]) => seam.book(...a) }));
vi.mock("@/lib/saved/actions", () => ({ toggleSave: (...a: unknown[]) => seam.save(...a) }));
vi.mock("@/lib/bookings/checkout", () => ({ startCardCheckout: (...a: unknown[]) => seam.checkout(...a) }));
vi.mock("@/lib/listings/repository", () => ({
  getListingRepository: () => ({ byId: async (id: string) => ({ id, title: "Two bed", isDemo: false, photos: ["https://x.test/1.jpg"], kind: "apartment" }) }),
}));

const { assistantDecide, assistantProposeViewing, assistantSave, assistantViewingSlots, assistantRetry } = await import("./action-actions");

const PID = "33333333-3333-4333-8333-333333333333";
const LID = "11111111-1111-4111-8111-111111111111";
const BID = "44444444-4444-4444-8444-444444444444";
const HASH = "a".repeat(64);
const SLOT = new Date(Date.now() + 3 * 86_400_000).toISOString();

beforeEach(() => {
  seam.signedIn = true;
  seam.rpc = {};
  seam.calls = [];
  seam.proposal = null;
  seam.booking = null;
  seam.locked = null;
  seam.book.mockReset();
  seam.save.mockReset();
  seam.checkout.mockReset();
});

const fns = () => seam.calls.map((c) => c.fn);

describe("every action refuses a signed-out caller", () => {
  it("does nothing", async () => {
    seam.signedIn = false;
    const out = await assistantDecide({ proposalId: PID, payloadHash: HASH, decision: "confirm" });
    expect(out.ok).toBe(false);
    expect(seam.book).not.toHaveBeenCalled();
    expect(seam.calls).toEqual([]);
  });
});

describe("confirming a viewing", () => {
  const viewing = { id: PID, kind: "viewing_request", status: "pending", payload: { listing_id: LID, slot_at: SLOT, title: "Two bed" }, result: null };

  it("runs the EXISTING booking code only after the database accepted the proposal, with the stored payload", async () => {
    seam.proposal = viewing;
    seam.rpc.ai_proposal_decide = { ok: true, decision: "confirm", kind: "viewing_request", payload: viewing.payload };
    seam.rpc.ai_proposal_result = { ok: true };
    seam.book.mockResolvedValue({ ok: true, data: { id: "i1" } });
    const out = await assistantDecide({ proposalId: PID, payloadHash: HASH, decision: "confirm" });
    expect(out).toMatchObject({ ok: true, data: { kind: "viewing_booked" } });
    expect(seam.book).toHaveBeenCalledTimes(1);
    expect(seam.book).toHaveBeenCalledWith({ listingId: LID, slotAt: SLOT, tapKey: PID });
    expect(fns()).toEqual(expect.arrayContaining(["ai_proposal_decide", "ai_proposal_result"]));
  });

  it.each(["expired", "revoked", "hash_mismatch", "already_decided", "not_found"])("does nothing when the database answers %s (replays, stale and revoked buttons)", async (reason) => {
    seam.proposal = viewing;
    seam.rpc.ai_proposal_decide = { ok: false, reason };
    const out = await assistantDecide({ proposalId: PID, payloadHash: HASH, decision: "confirm" });
    expect(out.ok).toBe(false);
    expect(seam.book).not.toHaveBeenCalled();
  });

  it("never says booked when the booking code refuses, and records the failure so a retry is possible", async () => {
    seam.proposal = viewing;
    seam.rpc.ai_proposal_decide = { ok: true, decision: "confirm", kind: "viewing_request", payload: viewing.payload };
    seam.rpc.ai_proposal_result = { ok: true };
    seam.book.mockResolvedValue({ ok: false, error: "That time was just taken." });
    const out = await assistantDecide({ proposalId: PID, payloadHash: HASH, decision: "confirm" });
    expect(out).toMatchObject({ ok: false, error: "That time was just taken." });
    const recorded = seam.calls.find((c) => c.fn === "ai_proposal_result");
    expect(recorded?.args?.p_result).toMatchObject({ ok: false });
  });

  it("rejects a malformed hash before touching anything", async () => {
    const out = await assistantDecide({ proposalId: PID, payloadHash: "nope", decision: "confirm" });
    expect(out.ok).toBe(false);
    expect(seam.calls).toEqual([]);
  });
});

describe("paying", () => {
  const pay = { id: PID, kind: "payment_review", status: "pending", payload: { target_kind: "booking", booking_id: BID, amount_minor: 5_000_000, currency: "NGN", title: "Two bed" }, result: null };
  const pendingBooking = { id: BID, listing_id: LID, guest_id: "u1", total_minor: 5_000_000, currency: "NGN", status: "PENDING", cleaning_fee_minor: 0, service_fee_minor: 0, subtotal_minor: 5_000_000 };

  it("stops BEFORE using the proposal up when the Vallo session is locked", async () => {
    seam.proposal = pay;
    seam.locked = "Unlock Vallo with your passcode first.";
    const out = await assistantDecide({ proposalId: PID, payloadHash: HASH, decision: "confirm" });
    expect(out).toMatchObject({ ok: false, error: "Unlock Vallo with your passcode first." });
    expect(fns()).not.toContain("ai_proposal_decide");
    expect(seam.checkout).not.toHaveBeenCalled();
  });

  it("cancels the proposal and charges nothing when the amount changed since it was shown", async () => {
    seam.proposal = pay;
    seam.booking = { ...pendingBooking, total_minor: 6_000_000 };
    seam.rpc.ai_proposal_decide = { ok: true, decision: "cancel", kind: "payment_review" };
    const out = await assistantDecide({ proposalId: PID, payloadHash: HASH, decision: "confirm" });
    expect(out.ok).toBe(false);
    expect(seam.checkout).not.toHaveBeenCalled();
    expect(seam.calls.find((c) => c.fn === "ai_proposal_decide")?.args?.p_decision).toBe("cancel");
  });

  it("opens the EXISTING secure checkout with the proposal id as its idempotency key, and returns its page", async () => {
    seam.proposal = pay;
    seam.booking = pendingBooking;
    seam.rpc.ai_proposal_decide = { ok: true, decision: "confirm", kind: "payment_review", payload: pay.payload };
    seam.rpc.ai_proposal_result = { ok: true };
    seam.checkout.mockResolvedValue({ ok: true, data: { authorizationUrl: "https://pay.example/x", accessCode: "ac", reference: "ref1", amountMinor: 5_000_000 } });
    const out = await assistantDecide({ proposalId: PID, payloadHash: HASH, decision: "confirm" });
    expect(out).toMatchObject({ ok: true, data: { kind: "open_checkout", url: "https://pay.example/x" } });
    expect(seam.checkout).toHaveBeenCalledWith({ bookingId: BID, idempotencyKey: PID });
    /* It claims nothing was paid: the page opens, the provider decides. */
    expect(JSON.stringify(out)).not.toMatch(/paid|success/i);
  });

  it("returns the real refusal when the checkout cannot open, and records it", async () => {
    seam.proposal = pay;
    seam.booking = pendingBooking;
    seam.rpc.ai_proposal_decide = { ok: true, decision: "confirm", kind: "payment_review", payload: pay.payload };
    seam.rpc.ai_proposal_result = { ok: true };
    seam.checkout.mockResolvedValue({ ok: false, error: "Payment is temporarily unavailable." });
    const out = await assistantDecide({ proposalId: PID, payloadHash: HASH, decision: "confirm" });
    expect(out).toMatchObject({ ok: false, error: "Payment is temporarily unavailable." });
  });
});

describe("saving, times and retries", () => {
  it("saves only through a confirmed proposal, and not at all without the permission", async () => {
    seam.rpc.ai_proposal_create = { ok: false, reason: "not_granted" };
    const refused = await assistantSave({ listingId: LID, want: true });
    expect(refused.ok).toBe(false);
    expect(seam.save).not.toHaveBeenCalled();

    seam.rpc.ai_proposal_create = { ok: true, id: PID, payload_hash: HASH, expires_at: SLOT };
    seam.rpc.ai_proposal_decide = { ok: true, decision: "confirm", kind: "save_listing", payload: { listing_id: LID } };
    seam.rpc.ai_proposal_result = { ok: true };
    seam.save.mockResolvedValue({ ok: true, data: { mode: "db", listingId: LID, saved: true } });
    const out = await assistantSave({ listingId: LID, want: true });
    expect(out).toMatchObject({ ok: true, data: { saved: true } });
    expect(seam.save).toHaveBeenCalledWith({ listingId: LID, want: true });
  });

  it("only proposes a time that is one of the real open slots", async () => {
    seam.rpc.viewing_slots = [{ slot_at: SLOT, slot_minutes: 30, window_id: "w" }];
    seam.rpc.ai_proposal_create = { ok: true, id: PID, payload_hash: HASH, expires_at: SLOT };
    const real = await assistantProposeViewing({ listingId: LID, slotAt: SLOT });
    expect(real).toMatchObject({ ok: true, data: { proposalId: PID } });
    const invented = await assistantProposeViewing({ listingId: LID, slotAt: new Date(Date.now() + 8 * 86_400_000).toISOString() });
    expect(invented.ok).toBe(false);
  });

  it("lists viewing times only with the bookings and viewings permission", async () => {
    seam.rpc.ai_assistant_can = false;
    seam.rpc.ai_assistant_audit_write = null;
    seam.rpc.viewing_slots = [{ slot_at: SLOT, slot_minutes: 30, window_id: "w" }];
    expect((await assistantViewingSlots({ listingId: LID })).ok).toBe(false);
    seam.rpc.ai_assistant_can = true;
    expect(await assistantViewingSlots({ listingId: LID })).toMatchObject({ ok: true, data: { listingId: LID } });
  });

  it("retries only as a new proposal", async () => {
    seam.rpc.ai_proposal_retry = { ok: true, id: "55555555-5555-4555-8555-555555555555", payload_hash: HASH };
    expect(await assistantRetry({ proposalId: PID })).toMatchObject({ ok: true, data: { proposalId: "55555555-5555-4555-8555-555555555555" } });
    seam.rpc.ai_proposal_retry = { ok: false, reason: "not_retryable" };
    expect((await assistantRetry({ proposalId: PID })).ok).toBe(false);
  });
});
