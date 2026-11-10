/**
 * THE PROTECTED PAYMENT READ FAILS CLOSED (lib/money/protected-read.ts).
 *
 * Pinned: while the switch is off nothing is read at all, so the fund and
 * held pages behave exactly as before; a Payluk row, a stranger, a missing
 * category function, any category status but approved, and a sale each give
 * null; the lifecycle columns are read only when present; "I've made the
 * transfer" is read from transfer_reported_at and never moves the status;
 * the screens nobody asks for come from the recorded review reason; the
 * partner mark needs both the provider's asset and the flag; and the pay
 * choice keeps rent closed whatever this rail says.
 */
import { describe, expect, it, vi } from "vitest";
import { fakeSupabase, type Script } from "../testing/fake-supabase";

vi.mock("../payments/providers/escrowpay/switch", () => ({ escrowPayEnabled: async () => false }));
vi.mock("../flags/read", () => ({ flagIsOn: async () => true }));
vi.mock("../actions/session", () => ({ resolveSession: async () => ({ state: "signed-out" }) }));

const { buildProtectedDeal, buildMyProtectedPayments, partnerMarkOn, readProtectedDeal } = await import("./protected-read");
const { payChoiceView } = await import("../payments/rail-choice");

const PAYER = "11111111-1111-4111-8111-111111111111";
const LISTER = "22222222-2222-4222-8222-222222222222";
const STRANGER = "99999999-9999-4999-8999-999999999999";
const AGREEMENT = "33333333-3333-4333-8333-333333333333";
const NOW = Date.parse("2026-11-10T10:00:00Z");

const on = { enabled: async () => true, now: NOW };
const off = { enabled: async () => false, now: NOW };
const noMark = async () => false;

/** An arrangement as it stands BEFORE the pending columns: none of them present. */
const bare = {
  id: "44444444-4444-4444-8444-444444444444",
  agreement_id: AGREEMENT,
  provider: "escrowpay",
  reference: "VAL-PP-TEST01",
  amount_minor: 180_000_00,
  status: "awaiting_payment",
  buyer_user_id: PAYER,
  seller_user_id: LISTER,
  status_observed_at: "2026-11-10T09:00:00Z",
  created_at: "2026-11-10T09:00:00Z",
};

function script(over: { arrangement?: Record<string, unknown> | null; category?: { data?: unknown; error?: unknown } } = {}): Script {
  return {
    provider_arrangements: { select: { data: over.arrangement === undefined ? bare : over.arrangement, error: null } },
    protected_category_status_for_agreement: { rpc: over.category ?? { data: { category: "shortlet", status: "approved" }, error: null } },
    deal_agreements: {
      select: { data: { id: AGREEMENT, kind: "stay", listing_id: "l1", renter_id: PAYER, owner_id: LISTER, terms: { check_in: "2026-12-12", check_out: "2026-12-15" }, terms_version: 2 } },
    },
    listings: { select: { data: { title: "A shortlet", area: "Lekki", city: "Lagos" } } },
    profiles: { select: { data: [{ id: PAYER, display_name: "Ada" }, { id: LISTER, display_name: "Bayo" }] } },
    bank_accounts: { select: { data: [] } },
    agents: { select: { data: [] } },
  };
}

describe("the protected read, switched off", () => {
  it("reads nothing at all and answers null", async () => {
    const db = fakeSupabase(script());
    expect(await buildProtectedDeal(db.client as never, PAYER, AGREEMENT, off, noMark)).toBeNull();
    expect(db.calls).toHaveLength(0);
  });

  it("the page's own door is null with the real switch off, before any session is read", async () => {
    expect(await readProtectedDeal(AGREEMENT, NOW)).toBeNull();
  });

  it("lists nothing and reads nothing", async () => {
    const db = fakeSupabase(script());
    expect(await buildMyProtectedPayments(db.client as never, PAYER, off)).toEqual([]);
    expect(db.calls).toHaveLength(0);
  });

  it("a switch that throws is off", async () => {
    const db = fakeSupabase(script());
    const broken = { enabled: async () => Promise.reject(new Error("flag read failed")), now: NOW };
    expect(await buildProtectedDeal(db.client as never, PAYER, AGREEMENT, broken, noMark)).toBeNull();
    expect(db.calls).toHaveLength(0);
  });
});

describe("the protected read, switched on, still fails closed", () => {
  it.each([
    ["a Payluk arrangement", { arrangement: { ...bare, provider: "payluk" } }],
    ["no arrangement", { arrangement: null }],
    ["the category function not applied yet", { category: { data: null, error: { code: "PGRST202", message: "Could not find the function" } } }],
    ["a disabled category", { category: { data: { category: "shortlet", status: "disabled" } } }],
    ["a pending category", { category: { data: { category: "residential_rent", status: "pending_approval" } } }],
    ["an unknown status word", { category: { data: { category: "shortlet", status: "APPROVED" } } }],
    ["an unknown category", { category: { data: { category: "boat", status: "approved" } } }],
    ["a sale, which is never paid on Vallo", { category: { data: { category: "land_sale", status: "approved" } } }],
    ["an unknown arrangement state", { arrangement: { ...bare, status: "funded" } }],
  ])("%s gives null", async (_name, over) => {
    const db = fakeSupabase(script(over as never));
    expect(await buildProtectedDeal(db.client as never, PAYER, AGREEMENT, on, noMark)).toBeNull();
    expect(db.wrote()).toBe(db.calls.some((c) => c.op === "rpc"));
    expect(db.calls.filter((c) => c.op !== "select" && c.op !== "rpc")).toEqual([]);
  });

  it("a stranger to the arrangement gets null", async () => {
    const db = fakeSupabase(script());
    expect(await buildProtectedDeal(db.client as never, STRANGER, AGREEMENT, on, noMark)).toBeNull();
  });

  it("a read that throws gives null", async () => {
    const db = fakeSupabase({ ...script(), provider_arrangements: { select: "throw" } });
    expect(await buildProtectedDeal(db.client as never, PAYER, AGREEMENT, on, noMark)).toBeNull();
  });
});

describe("the protected read, approved", () => {
  it("builds the payer's deal from a row without any pending column, writing nothing", async () => {
    const db = fakeSupabase(script());
    const read = await buildProtectedDeal(db.client as never, PAYER, AGREEMENT, on, noMark);
    expect(read).not.toBeNull();
    expect(read!.role).toBe("payer");
    expect(read!.deal).toMatchObject({
      reference: "VAL-PP-TEST01",
      amountMinor: 180_000_00,
      category: "shortlet",
      milestone: "check_in",
      status: "awaiting_payment",
      transferReported: false,
      funding: null,
      lastCheckedAt: null,
      payerName: "Ada",
      payeeName: "Bayo",
      place: { title: "A shortlet", area: "Lekki, Lagos" },
      dates: "12 December to 15 December",
      issue: null,
      partnerMark: false,
      links: { how: "/docs/how-protection-works", receipt: null },
    });
    expect(read!.deal.stamps).toEqual({ fundedAt: null, releaseRequestedAt: null, releaseConfirmedAt: null, refundConfirmedAt: null });
    expect(db.calls.filter((c) => c.op !== "select" && c.op !== "rpc")).toEqual([]);
    expect(db.of("provider_arrangements", "select")[0]?.filters).toContainEqual(["eq", "agreement_id", AGREEMENT]);
  });

  it("reads the lifecycle columns when they are there, and 'I've made the transfer' only as a request", async () => {
    const db = fakeSupabase(
      script({
        arrangement: {
          ...bare,
          transfer_reported_at: "2026-11-10T09:30:00Z",
          funding_instructions: { bank_name: "A Bank", account_name: "Collection", account_number: "0101010101" },
          funding_expires_at: "2026-11-10T10:30:00Z",
          last_provider_check_at: "2026-11-10T09:58:00Z",
          provider_reference: "EP-123",
          accepted_agreement_version: 2,
        },
      }),
    );
    const read = await buildProtectedDeal(db.client as never, PAYER, AGREEMENT, on, noMark);
    expect(read!.deal.transferReported).toBe(true);
    expect(read!.deal.status).toBe("awaiting_payment");
    expect(read!.deal.funding).toEqual({ bank: "A Bank", accountName: "Collection", accountNumber: "0101010101", expiresAt: "2026-11-10T10:30:00Z" });
    expect(read!.deal.lastCheckedAt).toBe("2026-11-10T09:58:00Z");
    expect(read!.deal.receipt).toEqual({ providerReference: "EP-123", agreementVersion: 2, refundRequestedAt: null });
  });

  it("draws no transfer details when the provider's instruction is incomplete", async () => {
    const db = fakeSupabase(script({ arrangement: { ...bare, funding_instructions: { bank_name: "A Bank" } } }));
    expect((await buildProtectedDeal(db.client as never, PAYER, AGREEMENT, on, noMark))!.deal.funding).toBeNull();
  });

  it("a wrong amount under review becomes its own screen, with the amount the bank reported", async () => {
    const db = fakeSupabase(script({ arrangement: { ...bare, status: "requires_review", review_reason: "amount_mismatch received_minor=170000000" } }));
    const read = await buildProtectedDeal(db.client as never, PAYER, AGREEMENT, on, noMark);
    expect(read!.deal.issue).toEqual({ kind: "amount_mismatch", receivedMinor: 170_000_000 });
  });

  it("the lister's side: their own role, and a missing payout account said only when both reads answered", async () => {
    const db = fakeSupabase(script());
    const read = await buildProtectedDeal(db.client as never, LISTER, AGREEMENT, on, noMark);
    expect(read!.role).toBe("lister");
    expect(read!.deal.listerPayoutMissing).toBe(true);
    const failing = fakeSupabase({ ...script(), bank_accounts: { select: { data: null, error: { message: "denied" } } } });
    expect((await buildProtectedDeal(failing.client as never, LISTER, AGREEMENT, on, noMark))!.deal.listerPayoutMissing).toBe(false);
  });

  it("a rental's milestone is the keys", async () => {
    const db = fakeSupabase(script({ category: { data: { category: "residential_rent", status: "approved" } } }));
    expect((await buildProtectedDeal(db.client as never, PAYER, AGREEMENT, on, noMark))!.deal.milestone).toBe("keys");
  });

  it("lists the viewer's approved protected payments with their stage", async () => {
    const db = fakeSupabase({
      ...script(),
      provider_arrangements: { select: { data: [{ ...bare, status: "released" }, { ...bare, reference: "PAYLUK-1", provider: "payluk" }] } },
      deal_agreements: { select: { data: [{ id: AGREEMENT, listing_id: "l1" }] } },
      listings: { select: { data: [{ id: "l1", title: "A shortlet" }] } },
    });
    const rows = await buildMyProtectedPayments(db.client as never, PAYER, on);
    expect(rows).toEqual([
      expect.objectContaining({ reference: "VAL-PP-TEST01", stage: "released", title: "A shortlet", role: "payer", href: `/agreements/${AGREEMENT}/held` }),
    ]);
  });
});

describe("the partner mark", () => {
  it("is not drawn while the provider's asset is not supplied, whatever the flag says", async () => {
    expect(await partnerMarkOn(async () => true)).toBe(false);
  });
});

describe("the pay choice keeps rent closed", () => {
  it("draws no rail for a rental, even with the protected option offered", () => {
    const choice = { options: ["escrow", "card"] as ("escrow" | "card")[], defaultRail: "escrow" as const, chosen: null, rail: "escrow" as const, payer: true, locked: null };
    expect(payChoiceView(choice, "rent")).toEqual({ mode: "rent_not_open", selected: null, canChoose: false });
  });
});
