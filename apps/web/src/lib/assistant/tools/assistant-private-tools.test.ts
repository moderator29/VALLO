import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/listings/repository", () => ({
  getListingRepository: () => ({
    byId: async (id: string) =>
      id === "11111111-1111-4111-8111-111111111111"
        ? { id, title: "Two bed in Lekki", kind: "apartment", area: "Lekki", city: "Lagos", state: "Lagos", priceMinor: 500_000_00, pricePeriod: "year", rating: 4.5, reviewCount: 3, verified: true, bedrooms: 2, bathrooms: 2, amenities: [], photos: ["https://x.test/a.jpg"], isDemo: false }
        : id === "22222222-2222-4222-8222-222222222222"
          ? { id, title: "Example flat", kind: "apartment", area: "Yaba", city: "Lagos", state: "Lagos", priceMinor: 100_00, pricePeriod: "year", rating: 0, reviewCount: 0, verified: false, bedrooms: 1, bathrooms: 1, amenities: [], photos: [], isDemo: true }
          : null,
    search: async () => [],
  }),
}));
vi.mock("@/lib/money/history", () => ({
  readMyPayments: async () => ({
    state: "ok",
    nextBefore: null,
    summary: { paidMinor: 0, payments: 0, refundedMinor: 0 },
    entries: [
      { id: "e1", kind: "payment", occurredAt: new Date().toISOString(), amountMinor: 1_000_00, direction: "out", status: "SUCCESSFUL", title: "Stay in Ikoyi", reference: null, bookingId: "b1" },
      { id: "e2", kind: "refund", occurredAt: new Date().toISOString(), amountMinor: 250_00, direction: "in", status: "COMPLETED", title: "Refund", reference: null, bookingId: "b1" },
    ],
  }),
}));
vi.mock("@/lib/money/member-wallet", () => ({ readMyBalance: async () => ({ state: "not-live", reason: "not_configured" }) }));

const { runTool, TOOL_REGISTRY, toolsFor } = await import("./registry");
const { preferenceKey, profileFrom, scoreCandidate, hasSignal } = await import("./saved");
const { periodBounds } = await import("./private-common");

const ID = "11111111-1111-4111-8111-111111111111";
const EX = "22222222-2222-4222-8222-222222222222";

type Call = { fn: string; args?: Record<string, unknown> };
function client(answers: Record<string, unknown>) {
  const calls: Call[] = [];
  return {
    calls,
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, ...(args ? { args } : {}) });
      return { data: answers[fn], error: null };
    },
    from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }), maybeSingle: async () => ({ data: null }) }), in: async () => ({ data: [] }) }) }),
    auth: { getUser: async () => ({ data: { user: { created_at: "2026-01-01T00:00:00Z" } } }) },
  };
}
const allow = { ai_assistant_can: true, ai_assistant_audit_write: null, ai_assistant_state: {} };
const deny = { ai_assistant_can: false, ai_assistant_audit_write: null };
const ctx = (c: unknown, permissions: string[] = []) => ({
  frame: "consumer" as const,
  supabase: c,
  userId: "u1",
  access: { enabled: true, permissions: permissions as never, epoch: 1 },
});

const PRIVATE = [
  "get_viewing_options",
  "propose_viewing",
  "list_my_viewings",
  "list_my_bookings",
  "list_saved_listings",
  "propose_save_listing",
  "picked_for_you",
  "remember_preference",
  "list_my_transactions",
  "spend_summary",
  "get_refund_status",
  "get_wallet_balance",
  "get_account_summary",
  "propose_payment",
];

describe("private tools are hidden and refused without their permission", () => {
  it("offers none of them when the assistant is OFF or nothing is granted", () => {
    const off = toolsFor("consumer").map((t) => t.name);
    for (const name of PRIVATE) expect(off, name).not.toContain(name);
    const discoveryOnly = toolsFor("consumer", TOOL_REGISTRY, { enabled: true, permissions: ["discovery"], epoch: 1 }).map((t) => t.name);
    for (const name of PRIVATE) expect(discoveryOnly, name).not.toContain(name);
    expect(discoveryOnly).toContain("get_listing_photos");
  });

  it("offers each tool only with its own permission", () => {
    const names = (p: string) => toolsFor("consumer", TOOL_REGISTRY, { enabled: true, permissions: [p as never], epoch: 1 }).map((t) => t.name);
    expect(names("transactions")).toEqual(expect.arrayContaining(["list_my_transactions", "spend_summary", "get_refund_status"]));
    expect(names("transactions")).not.toContain("get_wallet_balance");
    expect(names("transactions")).not.toContain("propose_payment");
    expect(names("wallet_balance")).toContain("get_wallet_balance");
    expect(names("payment_assist")).toContain("propose_payment");
    expect(names("account_info")).toContain("get_account_summary");
    expect(names("bookings_viewings")).toEqual(expect.arrayContaining(["get_viewing_options", "propose_viewing", "list_my_viewings", "list_my_bookings"]));
    expect(names("saved_prefs")).toEqual(expect.arrayContaining(["picked_for_you", "remember_preference", "list_saved_listings", "propose_save_listing"]));
  });

  it.each(PRIVATE)("%s is refused by the database check when the permission is gone, and audited", async (name) => {
    const c = client(deny);
    const out = await runTool(name, {}, ctx(c, []));
    expect(out.ok).toBe(false);
    expect(c.calls.some((x) => x.fn === "ai_assistant_audit_write" && x.args?.p_outcome === "denied")).toBe(true);
  });

  it("never runs a private tool for a signed-out caller", async () => {
    const out = await runTool("list_my_transactions", {}, { frame: "consumer", supabase: client(allow) });
    expect(out.ok).toBe(false);
  });
});

describe("private tools return the minimum, as events the server built", () => {
  it("reads transactions, builds a summary event and audits the call", async () => {
    const c = client(allow);
    const out = await runTool("list_my_transactions", { period: "all", limit: 5 }, ctx(c, ["transactions"]));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.outcome.events?.[0]).toMatchObject({ type: "summary" });
    expect(JSON.stringify(out.outcome.data)).not.toMatch(/reference|bookingId|booking_id|"id"/);
    expect(c.calls.some((x) => x.fn === "ai_assistant_audit_write" && x.args?.p_event === "tool_run" && x.args?.p_outcome === "ok")).toBe(true);
  });

  it("adds up spend and refunds exactly from the records", async () => {
    const out = await runTool("spend_summary", { period: "all" }, ctx(client(allow), ["transactions"]));
    expect(out.ok && out.outcome.data).toMatchObject({ paid: expect.stringContaining("1,000"), refunded: expect.stringContaining("250") });
  });

  it("says plainly when the balance is not live and invents no figure", async () => {
    const out = await runTool("get_wallet_balance", {}, ctx(client(allow), ["wallet_balance"]));
    expect(out.ok && out.outcome.note).toMatch(/not switched on|plainly/i);
    expect(out.ok && JSON.stringify(out.outcome.data)).not.toMatch(/\d/);
  });

  it("returns real photos for a real listing and refuses an example one", async () => {
    const real = await runTool("get_listing_photos", { listing_id: ID }, { frame: "consumer" });
    expect(real.ok && real.outcome.events?.[0]).toMatchObject({ type: "photos", urls: ["https://x.test/a.jpg"] });
    const ex = await runTool("get_listing_photos", { listing_id: EX }, { frame: "consumer" });
    expect(ex.ok && ex.outcome.events).toBeUndefined();
    expect(ex.ok && ex.outcome.note).toMatch(/example/i);
  });

  it("builds a card whose buttons come from the row and not from the model", async () => {
    const out = await runTool("get_listing_details", { listing_id: ID }, ctx(client(allow), ["bookings_viewings"]));
    if (!out.ok) throw new Error("expected ok");
    const card = (out.outcome.events?.[0] as { items: { actions: { kind: string; href?: string }[] }[] }).items[0]!;
    expect(card.actions.map((a) => a.kind)).toEqual(["link", "photos", "slots", "save", "ask"]);
    expect(card.actions[0]?.href).toBe(`/listing/${ID}`);
  });

  it("offers viewing times only from the real open slots, and prepares a proposal for a real one", async () => {
    const slotAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const c = client({ ...allow, viewing_slots: [{ slot_at: slotAt, slot_minutes: 30, window_id: "w" }], ai_proposal_create: { ok: true, id: "p1", payload_hash: "a".repeat(64), expires_at: slotAt } });
    const options = await runTool("get_viewing_options", { listing_id: ID }, ctx(c, ["bookings_viewings"]));
    expect(options.ok && options.outcome.events?.[0]).toMatchObject({ type: "slots", listingId: ID });
    const made = await runTool("propose_viewing", { listing_id: ID, slot_at: slotAt }, ctx(c, ["bookings_viewings"]));
    if (!made.ok) throw new Error("expected ok");
    expect(JSON.stringify(made.outcome.events)).toContain("Confirm viewing");
    expect(JSON.stringify(made.outcome.data)).not.toContain("p1");
    const invented = await runTool("propose_viewing", { listing_id: ID, slot_at: new Date(Date.now() + 9 * 86_400_000).toISOString() }, ctx(c, ["bookings_viewings"]));
    expect(invented.ok && JSON.stringify(invented.outcome.data)).toContain("not one of the open times");
  });

  it("refuses to arrange a viewing of an example listing", async () => {
    const out = await runTool("get_viewing_options", { listing_id: EX }, ctx(client(allow), ["bookings_viewings"]));
    expect(out.ok && out.outcome.note).toMatch(/example/i);
  });

  it("never returns an email, phone number or token in the account summary", async () => {
    const out = await runTool("get_account_summary", {}, ctx(client(allow), ["account_info"]));
    expect(JSON.stringify(out)).not.toMatch(/@.*\.|\+234|token|password|passcode/i);
  });
});

describe("remembering and picking", () => {
  it("keeps only known dimensions and clean short values", () => {
    expect(preferenceKey("city", "  Lekki!! <script> ")).toBe("city:lekki script");
    expect(preferenceKey("password", "x")).toBeNull();
    expect(preferenceKey("city", "!!!")).toBeNull();
    expect(preferenceKey("style", "a".repeat(200))?.length).toBeLessThanOrEqual("style:".length + 40);
  });

  it("scores a place from what was saved and liked, and says why in plain words", () => {
    const saved = [{ city: "Lagos", kind: "apartment", bedrooms: 2 }, { city: "Lagos", kind: "apartment", bedrooms: 2 }] as never;
    const profile = profileFrom(saved, [{ key: "budget_max_naira:600000", weight: 3 }]);
    expect(hasSignal(profile)).toBe(true);
    const fit = scoreCandidate({ city: "Lagos", area: "Lekki", kind: "apartment", bedrooms: 2, priceMinor: 500_000_00 } as never, profile);
    expect(fit.score).toBeGreaterThan(0);
    expect(fit.reason).toMatch(/Lagos/);
    expect(fit.reason).not.toContain("—");
    const dear = scoreCandidate({ city: "Lagos", area: "Lekki", kind: "apartment", bedrooms: 2, priceMinor: 900_000_00 } as never, profile);
    expect(dear.score).toBe(0);
    const disliked = profileFrom(saved, [{ key: "city:lagos", weight: -3 }]);
    expect(scoreCandidate({ city: "Lagos", area: "x", kind: "apartment", bedrooms: 2, priceMinor: 1 } as never, disliked).score).toBe(0);
  });

  it("has no signal for a member who saved and said nothing", () => {
    expect(hasSignal(profileFrom([], []))).toBe(false);
  });
});

describe("periods", () => {
  it("bounds this month and last month on the Lagos calendar", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    const month = periodBounds("this_month", now);
    expect(new Date(month.from).toISOString()).toBe("2026-10-31T23:00:00.000Z");
    const last = periodBounds("last_month", now);
    expect(new Date(last.from).toISOString()).toBe("2026-09-30T23:00:00.000Z");
    expect(last.to).toBe(month.from);
  });
});
