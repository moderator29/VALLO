import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The listing desk's decisions (`reviewListing`): which status takes which
 * decision, the rejection that must say why, the lister who may not decide
 * their own listing, and the two side effects every decision promises, the
 * lister told (`announce`) and one `listing.review` audit row with the before
 * and after status.
 */

type Call = { table: string; op: string; payload?: unknown; filters: [string, unknown][] };

const seam = vi.hoisted(() => ({
  calls: [] as Call[],
  results: {} as Record<string, { data?: unknown; error: unknown }>,
  announce: vi.fn(),
  audit: vi.fn(),
}));

function client() {
  return {
    from(table: string) {
      const call: Call = { table, op: "select", filters: [] };
      const chain: Record<string, unknown> = {};
      const settle = () => {
        seam.calls.push(call);
        return Promise.resolve(seam.results[`${table}.${call.op}`] ?? { data: null, error: null });
      };
      for (const op of ["update", "upsert", "delete", "insert"] as const) {
        chain[op] = (payload?: unknown) => {
          call.op = op;
          call.payload = payload;
          return chain;
        };
      }
      chain.select = () => chain;
      chain.eq = (column: string, value: unknown) => {
        call.filters.push([column, value]);
        return chain;
      };
      chain.maybeSingle = settle;
      chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        settle().then(resolve, reject);
      return chain;
    },
  };
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./guard", () => ({
  adminRefusal: () => "forbidden",
  requireAdmin: async () => ({ state: "admin", user: { id: "staff-1" }, supabase: client() }),
}));
vi.mock("../supabase/admin", () => ({ createAdminClient: () => client() }));
vi.mock("../notify/junction", () => ({ announce: seam.announce }));
vi.mock("./audit", () => ({ writeAudit: seam.audit }));
vi.mock("../stays/arrival-gate", () => ({
  ARRIVAL_DECLARATION_NEEDED: "declare the arrival charges",
  arrivalChargesDeclared: async () => true,
}));

const { reviewListing } = await import("./actions");

const LISTING = {
  id: "5f2504e0-4f89-41d3-9a0c-0305e82c3301",
  title: "Bright 2 bedroom flat in Lekki Phase 1",
  status: "SUBMITTED",
  agent_id: "agent-1",
  reference: null,
  published_at: null,
  agents: { user_id: "957b3bd2-cce3-425d-bba9-5cd876ca3d62" },
};

type Decision = "approve" | "publish" | "reject" | "request_changes";

const decide = (decision: Decision, extra: { notes?: string; reasons?: string[] } = {}) =>
  reviewListing({ listingId: LISTING.id, decision, ...extra });

const updates = () => seam.calls.filter((c) => c.table === "listings" && c.op === "update");

function holding(status: string, more: Record<string, unknown> = {}) {
  seam.results["listings.select"] = { data: { ...LISTING, status, ...more }, error: null };
}

beforeEach(() => {
  seam.calls = [];
  seam.announce.mockReset();
  seam.audit.mockReset();
  seam.results = {
    "listings.select": { data: LISTING, error: null },
    "listings.update": { data: [{ id: LISTING.id }], error: null },
  };
});

function expectNothingWritten() {
  expect(updates()).toHaveLength(0);
  expect(seam.announce).not.toHaveBeenCalled();
  expect(seam.audit).not.toHaveBeenCalled();
}

describe("who may decide", () => {
  it("refuses the lister deciding their own listing", async () => {
    holding("SUBMITTED", { agents: { user_id: "staff-1" } });
    const result = await decide("approve");
    expect(result.ok).toBe(false);
    expectNothingWritten();
  });

  it("refuses when the lister cannot be read, rather than skipping the own-listing rule", async () => {
    holding("SUBMITTED", { agents: null });
    const result = await decide("approve");
    expect(result.ok).toBe(false);
    expectNothingWritten();
  });
});

describe("which status takes which decision", () => {
  it("decides nothing on a draft or a rejected listing", async () => {
    for (const status of ["DRAFT", "REJECTED"]) {
      for (const decision of ["approve", "reject", "request_changes"] as const) {
        seam.calls = [];
        holding(status);
        const result = await decide(decision, { notes: "The photos are of a different flat." });
        expect(result.ok, `${decision} on ${status}`).toBe(false);
      }
    }
    expectNothingWritten();
  });

  it("will not approve a listing that is with the lister for changes, but can reject it or update the note", async () => {
    holding("MORE_INFO_REQUIRED");
    expect((await decide("approve")).ok).toBe(false);
    expectNothingWritten();

    holding("MORE_INFO_REQUIRED");
    expect((await decide("request_changes", { notes: "Add a photo of the kitchen too." })).ok).toBe(true);
    holding("MORE_INFO_REQUIRED");
    expect((await decide("reject", { notes: "The lister has not replied in thirty days." })).ok).toBe(true);
  });

  it("does not approve an approved listing twice, and publishes only an approved one", async () => {
    holding("APPROVED");
    expect((await decide("approve")).ok).toBe(false);
    holding("SUBMITTED");
    expect((await decide("publish")).ok).toBe(false);
    expectNothingWritten();

    holding("APPROVED");
    const published = await decide("publish");
    expect(published.ok).toBe(true);
    const payload = updates()[0]?.payload as Record<string, unknown>;
    expect(payload.status).toBe("PUBLISHED");
    expect(typeof payload.published_at).toBe("string");
  });

  it("writes only onto the status it read, so a second reviewer's click changes nothing", async () => {
    seam.results["listings.update"] = { data: [], error: null };
    const result = await decide("approve");
    expect(result.ok).toBe(false);
    expect(updates()[0]?.filters).toContainEqual(["status", "SUBMITTED"]);
    expect(seam.announce).not.toHaveBeenCalled();
    expect(seam.audit).not.toHaveBeenCalled();
  });
});

describe("a reason is required where the lister reads one", () => {
  it("refuses a rejection with no reason, or one under eight characters", async () => {
    expect((await decide("reject")).ok).toBe(false);
    expect((await decide("reject", { notes: "no" })).ok).toBe(false);
    expectNothingWritten();
  });

  it("refuses a send back with nothing to change", async () => {
    expect((await decide("request_changes")).ok).toBe(false);
    expectNothingWritten();
  });

  it("takes a reason chip on its own as a reason", async () => {
    const result = await decide("reject", { reasons: ["photos_elsewhere"] });
    expect(result.ok).toBe(true);
  });
});

describe("every decision tells the lister and leaves one audit row", () => {
  it("approve: APPROVED, the lister told it passed, the audit row with before and after", async () => {
    const result = await decide("approve");
    expect(result.ok).toBe(true);
    const payload = updates()[0]?.payload as Record<string, unknown>;
    expect(payload.status).toBe("APPROVED");
    expect(payload.reviewer_id).toBe("staff-1");
    expect(seam.announce).toHaveBeenCalledTimes(1);
    const announced = seam.announce.mock.calls[0]![1] as { recipient: unknown; notice: { title: string; body: string } };
    expect(announced.recipient).toEqual({ kind: "user", userId: LISTING.agents.user_id });
    expect(announced.notice.title).toBe("Listing passed review");
    expect(seam.audit).toHaveBeenCalledTimes(1);
    const entry = seam.audit.mock.calls[0]![1] as { action: string; entityType: string; entityId: string; actorId: string; detail: Record<string, unknown> };
    expect(entry).toMatchObject({ action: "listing.review", entityType: "listing", entityId: LISTING.id, actorId: "staff-1" });
    expect(entry.detail).toMatchObject({ before_status: "SUBMITTED", after_status: "APPROVED", decision: "approve" });
  });

  it("keeps the audit row when telling the lister throws", async () => {
    seam.announce.mockRejectedValueOnce(new Error("mail down"));
    const result = await reviewListing({ listingId: LISTING.id, decision: "approve" });
    expect(result.ok).toBe(true);
    expect(seam.audit).toHaveBeenCalledTimes(1);
  });

  it("reject: REJECTED with the reason stored, and the notice names the listing it is about", async () => {
    const result = await decide("reject", { reasons: ["photos_elsewhere"], notes: "Please use your own photographs." });
    expect(result.ok).toBe(true);
    const payload = updates()[0]?.payload as Record<string, unknown>;
    expect(payload.status).toBe("REJECTED");
    expect(String(payload.review_notes)).toContain("Please use your own photographs.");
    const announced = seam.announce.mock.calls[0]![1] as { notice: { title: string; body: string } };
    expect(announced.notice.title).toBe("Listing not approved");
    expect(announced.notice.body.startsWith(`${LISTING.title}: `)).toBe(true);
    expect(announced.notice.body).not.toContain("\n");
    const entry = seam.audit.mock.calls[0]![1] as { detail: Record<string, unknown> };
    expect(entry.detail).toMatchObject({ before_status: "SUBMITTED", after_status: "REJECTED", decision: "reject", reasons: "photos_elsewhere" });
  });

  it("request changes: MORE_INFO_REQUIRED, the note to the lister, the audit row", async () => {
    const result = await decide("request_changes", { notes: "Add a photo of the bathroom." });
    expect(result.ok).toBe(true);
    const payload = updates()[0]?.payload as Record<string, unknown>;
    expect(payload.status).toBe("MORE_INFO_REQUIRED");
    expect(payload.review_notes).toBe("Add a photo of the bathroom.");
    const announced = seam.announce.mock.calls[0]![1] as { notice: { title: string; body: string } };
    expect(announced.notice).toMatchObject({
      title: "Listing needs changes",
      body: `${LISTING.title}: Add a photo of the bathroom.`,
    });
    const entry = seam.audit.mock.calls[0]![1] as { detail: Record<string, unknown> };
    expect(entry.detail).toMatchObject({ before_status: "SUBMITTED", after_status: "MORE_INFO_REQUIRED", decision: "request_changes" });
  });
});
