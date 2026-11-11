import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A SIGNED-OUT VISITOR NEVER ASKS A FUNCTION ONLY A MEMBER MAY RUN.
 *
 * `listing_landlord_facts`, `property_offers`, `rent_landlord_fact`,
 * `mandate_consents`, `property_candidates` and `owner_heartbeats_open` are
 * granted to `authenticated` and revoked from `anon` on purpose: they are a
 * landlord's facts. `/search` and the listing page are open to signed-out
 * visitors, so the app asked anyway and Postgres answered 42501 every time.
 * The reads swallowed it and returned the empty answer, so the page looked
 * right while `crash_reports` filled with 1655 denials between 9 and 11
 * November, and every one of them aborted its transaction.
 *
 * `landlord_line_read` is the one that must still be asked: a landlord has no
 * account and reaches their question by a token link, which is why that
 * function alone is granted to `anon`.
 */

const seam = vi.hoisted(() => ({
  claims: { state: "signed-out" } as { state: string; userId?: string; supabase?: unknown },
  rpc: vi.fn(async () => ({ data: null, error: null })),
  reported: [] as unknown[],
}));

vi.mock("../actions/session", () => ({
  resolveSessionClaims: async () => seam.claims,
}));
vi.mock("../supabase/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("../supabase/server", () => ({
  createClient: async () => ({ rpc: (fn: string, args: unknown) => seam.rpc(fn as never, args as never) }),
}));
vi.mock("@/lib/observability/read-error", () => ({
  reportReadError: async (...a: unknown[]) => {
    seam.reported.push(a);
  },
}));

const queries = await import("./queries");

const LISTING = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  seam.claims = { state: "signed-out" };
  seam.rpc.mockClear();
  seam.rpc.mockResolvedValue({ data: null, error: null });
  seam.reported = [];
});

describe("signed out", () => {
  it("asks for no landlord facts, and answers the empty map", async () => {
    const facts = await queries.readListingFactsFor([LISTING]);
    expect(facts.size).toBe(0);
    expect(seam.rpc).not.toHaveBeenCalled();
  });

  it("answers no offers rather than a failed comparison", async () => {
    /* [] draws nothing; null would tell the reader the comparison did not
       load, which is a different and untrue sentence. */
    await expect(queries.readPropertyOffers(LISTING)).resolves.toEqual([]);
    expect(seam.rpc).not.toHaveBeenCalled();
  });

  it("asks for no rent fact, consents, candidates or heartbeats", async () => {
    await expect(queries.readRentFactFor(LISTING)).resolves.toBeNull();
    await expect(queries.readMandateConsents([LISTING])).resolves.toEqual(new Map());
    await expect(queries.readPropertyCandidates(LISTING)).resolves.toEqual([]);
    await expect(queries.readOpenOwnerHeartbeats()).resolves.toEqual([]);
    expect(seam.rpc).not.toHaveBeenCalled();
  });

  it("still reads the landlord's own question by token, which is granted to anon", async () => {
    seam.rpc.mockResolvedValue({ data: { state: "unknown" }, error: null });
    await queries.readReplyByToken("abcdefghijklmnopqrstuvwx");
    expect(seam.rpc).toHaveBeenCalledWith("landlord_line_read", { p_token: "abcdefghijklmnopqrstuvwx" });
  });
});

describe("signed in", () => {
  beforeEach(() => {
    seam.claims = { state: "signed-in", userId: "u1" };
  });

  it("asks exactly as it always did", async () => {
    seam.rpc.mockResolvedValue({ data: [], error: null });
    await queries.readListingFactsFor([LISTING]);
    expect(seam.rpc).toHaveBeenCalledWith("listing_landlord_facts", { p_listings: [LISTING] });
  });

  it("still reports a real read error rather than hiding it", async () => {
    seam.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } });
    await expect(queries.readListingFactsFor([LISTING])).resolves.toEqual(new Map());
    expect(seam.reported.length).toBe(1);
  });
});
