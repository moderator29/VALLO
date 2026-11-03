import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/listings/repository", () => ({ getListingRepository: () => ({ byId: async () => null, search: async () => [] }) }));

const { runTool } = await import("./registry");
const { profileFrom, scoreCandidate } = await import("./saved");

const MINE = "55555555-5555-4555-8555-555555555555";
const ahead = new Date(Date.now() + 2 * 86_400_000).toISOString();

type Call = { fn: string; args?: Record<string, unknown> };
function client(viewing: Record<string, unknown> | null) {
  const calls: Call[] = [];
  const filters: [string, string][] = [];
  return {
    calls,
    filters,
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, ...(args ? { args } : {}) });
      if (fn === "ai_assistant_can") return { data: true, error: null };
      if (fn === "ai_proposal_create") return { data: { ok: true, id: "66666666-6666-4666-8666-666666666666", payload_hash: "a".repeat(64), expires_at: ahead }, error: null };
      return { data: null, error: null };
    },
    from: () => ({
      select: () => {
        const chain = {
          eq: (c: string, v: string) => {
            filters.push([c, v]);
            return chain;
          },
          maybeSingle: async () => ({ data: viewing, error: null }),
          in: async () => ({ data: [{ id: "l1", title: "Two bed" }] }),
        };
        return chain;
      },
    }),
  };
}
const ctx = (c: unknown) => ({
  frame: "consumer" as const,
  supabase: c,
  userId: "u1",
  access: { enabled: true, permissions: ["bookings_viewings" as never], epoch: 1 },
});

describe("cancel and move go only through the member's OWN viewings", () => {
  it("reads the viewing filtered by the caller as requester", async () => {
    const c = client({ id: MINE, listing_id: "l1", requester_id: "u1", state: "CONFIRMED", slot_at: ahead, requested_at: ahead });
    const out = await runTool("propose_cancel_viewing", { inspection_id: MINE }, ctx(c));
    expect(out.ok).toBe(true);
    expect(c.filters).toContainEqual(["requester_id", "u1"]);
    expect(c.calls.some((x) => x.fn === "ai_proposal_create" && x.args?.p_kind === "cancel_viewing")).toBe(true);
  });

  it("refuses somebody else's viewing id without proposing anything", async () => {
    const c = client({ id: MINE, listing_id: "l1", requester_id: "someone-else", state: "CONFIRMED", slot_at: ahead, requested_at: ahead });
    const out = await runTool("propose_cancel_viewing", { inspection_id: MINE }, ctx(c));
    expect(out.ok && JSON.stringify(out.outcome.data)).toContain("not one of the person");
    expect(c.calls.some((x) => x.fn === "ai_proposal_create")).toBe(false);
  });

  it("refuses a closed viewing", async () => {
    const c = client({ id: MINE, listing_id: "l1", requester_id: "u1", state: "WITHDRAWN", slot_at: ahead, requested_at: ahead });
    const out = await runTool("propose_reschedule_viewing", { inspection_id: MINE, slot_at: ahead }, ctx(c));
    expect(c.calls.some((x) => x.fn === "ai_proposal_create")).toBe(false);
    expect(out.ok).toBe(true);
  });
});

describe("picks say when they come from what the member opened", () => {
  it("names the area they have been opening", () => {
    const p = profileFrom([], [{ key: "seen:area:lekki", weight: 4 }]);
    const l = { area: "Lekki", city: "Lagos", kind: "apartment", bedrooms: 2, priceMinor: 1 } as never;
    expect(scoreCandidate(l, p).reason).toMatch(/opening places in Lekki/);
  });

  it("never lets activity outweigh what the member said they dislike", () => {
    const p = profileFrom([], [{ key: "seen:area:lekki", weight: 5 }, { key: "area:lekki", weight: -3 }]);
    const l = { area: "Lekki", city: "Lagos", kind: "apartment", bedrooms: 2, priceMinor: 1 } as never;
    expect(scoreCandidate(l, p).score).toBe(0);
  });
});
