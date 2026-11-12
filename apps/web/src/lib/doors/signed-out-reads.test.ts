import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE SAME RULE AS `lib/landlord/signed-out-reads.test.ts`, ON THE DOORS.
 *
 * `my_agent_lookup` is granted to `authenticated` and revoked from `anon`,
 * and `inspection_safety_shares` grants SELECT to `authenticated` on nine
 * columns and to `anon` on none. A signed-out caller is therefore refused
 * 42501 by both, and a refused statement aborts its transaction.
 *
 * `safety_share_read` is granted to `anon` on purpose and must still be
 * asked: a renter's trusted contact has no account and arrives by a token
 * link, and that page's whole content is this read.
 */

const seam = vi.hoisted(() => ({
  claims: { state: "signed-out" } as { state: string; userId?: string },
  /* Typed at the seam rather than inferred, so a two-argument call and every
     mockResolvedValue below type-check. */
  rpc: vi.fn(
    async (
      _fn: string,
      _args: unknown,
    ): Promise<{ data: unknown; error: { code?: string; message?: string } | null }> => ({ data: null, error: null }),
  ),
  select: vi.fn(),
}));

vi.mock("../actions/session", () => ({ resolveSessionClaims: async () => seam.claims }));
vi.mock("../supabase/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("../supabase/server", () => ({
  createClient: async () => ({
    rpc: (fn: string, args: unknown) => seam.rpc(fn, args),
    from: (table: string) => {
      seam.select(table);
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.select = self;
      chain.is = self;
      chain.gt = self;
      chain.limit = async () => ({ data: [], error: null });
      return chain;
    },
  }),
}));
vi.mock("@/lib/observability/read-error", () => ({ reportReadError: async () => undefined }));

const doors = await import("./queries");

const TOKEN = "abcdefghijklmnopqrstuvwx";

beforeEach(() => {
  seam.claims = { state: "signed-out" };
  seam.rpc.mockClear();
  seam.select.mockClear();
  seam.rpc.mockResolvedValue({ data: null, error: null });
});

describe("signed out", () => {
  it("does not ask for the agent's own lookup code", async () => {
    await expect(doors.readMyAgentLookup()).resolves.toBeNull();
    expect(seam.rpc).not.toHaveBeenCalled();
  });

  it("does not select a table anon holds no grant on", async () => {
    await expect(doors.readMyLiveSafetyShares()).resolves.toEqual({});
    expect(seam.select).not.toHaveBeenCalled();
  });

  it("still reads a safety share by token, which is granted to anon", async () => {
    seam.rpc.mockResolvedValue({ data: { state: "unknown" }, error: null });
    await doors.readSafetyShareByToken(TOKEN);
    expect(seam.rpc).toHaveBeenCalledWith("safety_share_read", { p_token: TOKEN });
  });
});

describe("signed in", () => {
  beforeEach(() => {
    seam.claims = { state: "signed-in", userId: "u1" };
  });

  it("asks exactly as it always did", async () => {
    seam.rpc.mockResolvedValue({ data: { code: "VA-ABCDE", hint: "123" }, error: null });
    await expect(doors.readMyAgentLookup()).resolves.toEqual({ code: "VA-ABCDE", hint: "123" });
    expect(seam.rpc).toHaveBeenCalledWith("my_agent_lookup", {});
    await doors.readMyLiveSafetyShares();
    expect(seam.select).toHaveBeenCalledWith("inspection_safety_shares");
  });
});
