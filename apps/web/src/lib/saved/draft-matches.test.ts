import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * V-10's count reads other people's saved searches through the service role,
 * so it answers only for the caller's own listing. Row-level security returns
 * any PUBLISHED listing to anybody, which is why ownership is proven first.
 */

const LISTING = "3b0f1b0e-6f5a-4d1e-9b77-1c2d3e4f5a6b";

const state = vi.hoisted(() => ({
  agent: { id: "agent-1" } as { id: string } | null,
  owned: true,
  searchesRead: 0,
}));

function single(data: unknown) {
  const c: Record<string, unknown> = {};
  c.select = () => c;
  c.eq = () => c;
  c.maybeSingle = async () => ({ data, error: null });
  return c;
}

vi.mock("../actions/session", () => ({
  SIGNED_OUT_MESSAGE: "signed out",
  resolveSession: async () => ({
    state: "signed-in",
    user: { id: "user-1" },
    supabase: {
      from: (table: string) =>
        table === "agents" ? single(state.agent) : single(state.owned ? { id: LISTING } : null),
    },
  }),
}));
vi.mock("../listings/supabase-repository", () => ({
  loadOwnListingAnyStatus: async () => ({ id: LISTING, kind: "apartment" }),
}));
vi.mock("../listings/filter", () => ({ matchesFilter: () => true }));
vi.mock("./search-alerts", () => ({ filterFor: () => ({}) }));
vi.mock("./searches", () => ({ readStoredSearch: () => ({ params: {} }) }));
vi.mock("../locale", () => ({ getLocale: async () => "en" }));
vi.mock("../supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      state.searchesRead += 1;
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.eq = () => c;
      c.neq = () => c;
      c.limit = async () => ({
        data: [
          { user_id: "a", query: {} },
          { user_id: "b", query: {} },
          { user_id: "c", query: {} },
        ],
        error: null,
      });
      return c;
    },
  }),
}));

const { draftSavedSearchMatches } = await import("./draft-matches");

beforeEach(() => {
  state.agent = { id: "agent-1" };
  state.owned = true;
  state.searchesRead = 0;
});

describe("draftSavedSearchMatches", () => {
  it("counts for the caller's own listing", async () => {
    const result = await draftSavedSearchMatches({ listingId: LISTING });
    expect(result).toEqual({ ok: true, data: { people: 3 } });
  });

  it("reads nobody's searches for a listing the caller does not own", async () => {
    state.owned = false;
    const result = await draftSavedSearchMatches({ listingId: LISTING });
    expect(result.ok).toBe(false);
    expect(state.searchesRead).toBe(0);
  });

  it("reads nobody's searches for a caller with no lister account", async () => {
    state.agent = null;
    const result = await draftSavedSearchMatches({ listingId: LISTING });
    expect(result.ok).toBe(false);
    expect(state.searchesRead).toBe(0);
  });
});
